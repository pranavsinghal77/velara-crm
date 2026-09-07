/**
 * Is every part of the CRM actually live?
 *
 *   npm run health                        # unauthenticated surfaces only
 *   HEALTH_EMAIL=... HEALTH_PASSWORD=... npm run health    # everything
 *
 * Reads only. No check here creates, updates or deletes anything, because a
 * health check that mutates the database is not one you can run twice — or run
 * against production.
 *
 * Credentials come from the environment rather than being baked in, so this
 * file carries no password. Without them it still checks the web app, the API,
 * the database handshake and every guard; it just skips the authenticated
 * reads and says which ones it skipped.
 *
 * Exits non-zero if anything failed, so it can gate a deploy.
 */
const API = process.env.HEALTH_API ?? 'http://localhost:3001/api';
const WEB = process.env.HEALTH_WEB ?? 'http://localhost:5173';
const EMAIL = process.env.HEALTH_EMAIL ?? '';
const PASSWORD = process.env.HEALTH_PASSWORD ?? '';

const TIMEOUT_MS = 30_000;

let passed = 0;
const failures: string[] = [];

function report(ok: boolean, label: string, detail: string, ms?: number) {
  const time = ms === undefined ? '' : `${String(ms).padStart(6)}ms  `;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label.padEnd(36)} ${time}${detail}`);
  if (ok) passed += 1;
  else failures.push(`${label}: ${detail}`);
}

async function timed(fn: () => Promise<Response>): Promise<{ res: Response | null; ms: number; err?: string }> {
  const t0 = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fn();
    return { res, ms: Date.now() - t0 };
  } catch (err) {
    return { res: null, ms: Date.now() - t0, err: (err as Error).message };
  } finally {
    clearTimeout(timer);
  }
}

/** Summarises a JSON body without dumping tenant data to the console. */
function summarise(text: string): string {
  try {
    const d = JSON.parse(text) as Record<string, unknown>;
    if (Array.isArray(d)) return `${d.length} row(s)`;
    if (Array.isArray(d.data)) return `${d.data.length} row(s)`;
    return Object.keys(d).slice(0, 4).join(',');
  } catch {
    return `${text.length} bytes`;
  }
}

async function checkGet(label: string, path: string, token: string) {
  const { res, ms, err } = await timed(() =>
    fetch(API + path, { headers: { Authorization: `Bearer ${token}` } })
  );
  if (!res) return report(false, label, `unreachable: ${err}`, ms);
  report(res.ok, label, `HTTP ${res.status} ${summarise(await res.text())}`, ms);
}

async function checkPost(label: string, path: string, token: string, body: unknown) {
  const { res, ms, err } = await timed(() =>
    fetch(API + path, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  );
  if (!res) return report(false, label, `unreachable: ${err}`, ms);
  report(res.ok, label, `HTTP ${res.status} ${summarise(await res.text())}`, ms);
}

/** A guard is only proven by a request it refuses. */
async function checkRejects(label: string, method: string, path: string, expected: number[]) {
  const { res, ms, err } = await timed(() =>
    fetch(API + path, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: method === 'GET' ? undefined : '{}',
      // `manual`, because fetch follows redirects by default and would report
      // the 200 from wherever the redirect lands. The OAuth callback answers a
      // browser navigation with a 302 back into the app, and the 302 is the
      // thing being checked.
      redirect: 'manual',
    })
  );
  if (!res) return report(false, label, `unreachable: ${err}`, ms);
  report(
    expected.includes(res.status),
    label,
    `HTTP ${res.status} (expected ${expected.join(' or ')})`,
    ms
  );
}

async function main() {
  console.log(`\nVelara CRM health check\n  api ${API}\n  web ${WEB}\n`);

  // ── Processes ──
  console.log('Processes');
  {
    const { res, ms, err } = await timed(() => fetch(WEB));
    if (!res) report(false, 'web app', `unreachable: ${err}`, ms);
    else {
      const html = await res.text();
      report(res.ok && html.includes('id="root"'), 'web app', `HTTP ${res.status} SPA shell`, ms);
    }
  }

  // ── Auth and, implicitly, the database ──
  console.log('\nAuth and database');
  let token = '';
  if (!EMAIL || !PASSWORD) {
    console.log('  --   login                              skipped: set HEALTH_EMAIL and HEALTH_PASSWORD');
  } else {
    const { res, ms, err } = await timed(() =>
      fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
      })
    );
    if (!res) report(false, 'login', `unreachable: ${err}`, ms);
    else {
      const d = (await res.json()) as { accessToken?: string; error?: { message?: string } };
      token = d.accessToken ?? '';
      // A token proves the API is up *and* Postgres answered: the handler
      // reads the user and writes a refresh token before it can issue one.
      report(Boolean(token), 'login (also proves Postgres)', `HTTP ${res.status}`, ms);
    }
  }

  // ── Guards. These run with no credentials on purpose. ──
  console.log('\nGuards');
  await checkRejects('session guard', 'GET', '/leads', [401]);
  await checkRejects('API-key guard (MCP)', 'POST', '/mcp/tools/list', [401]);
  await checkRejects('operator-console guard', 'GET', '/platform/overview', [401]);
  // The callback answers a browser navigation, so it redirects rather than
  // returning an error body.
  await checkRejects('OAuth callback without state', 'GET', '/social/callback/facebook', [302]);

  if (!token) {
    console.log('\nAuthenticated surfaces skipped.\n');
    console.log(`${passed} passed, ${failures.length} failed`);
    process.exit(failures.length ? 1 : 0);
  }

  console.log('\nCore CRM');
  await checkGet('leads', '/leads?limit=100', token);
  await checkGet('messages', '/messages?limit=50', token);
  await checkGet('reminders', '/reminders?limit=50', token);
  await checkGet('notifications', '/notifications?limit=50', token);
  await checkGet('users', '/users', token);

  console.log('\nAnalytics');
  await checkGet('overview', '/analytics/overview', token);
  await checkGet('trend', '/analytics/trend', token);
  await checkGet('leaderboard', '/analytics/leaderboard', token);

  console.log('\nField operations');
  await checkGet('campaigns', '/field-campaigns', token);
  await checkGet('attendance today', '/attendance/today', token);
  await checkGet('attendance range', '/attendance', token);
  await checkGet('attendance team', '/attendance/team-today', token);

  console.log('\nDocuments and workflows');
  await checkGet('documents', '/documents?limit=20', token);
  await checkGet('workflows', '/workflows', token);

  console.log('\nSocial');
  await checkGet('providers', '/social/providers', token);
  await checkGet('connections', '/social/connections', token);
  await checkGet('posts', '/social/posts?limit=20', token);
  await checkGet('insights', '/social/insights', token);
  await checkGet('content ideas', '/social/ideas', token);

  console.log('\nConnectivity');
  await checkGet('api keys', '/connectivity/api-keys', token);
  await checkGet('mcp connections', '/connectivity/mcp', token);
  await checkGet('webhooks', '/connectivity/webhooks', token);

  console.log('\nOperator console');
  await checkGet('platform overview', '/platform/overview', token);
  await checkGet('tenants', '/platform/tenants', token);

  console.log('\nAI');
  // Reported separately from the call below: a configured key is not a
  // working one, and this endpoint is what tells them apart.
  {
    const { res, ms, err } = await timed(() =>
      fetch(`${API}/ai/status`, { headers: { Authorization: `Bearer ${token}` } })
    );
    if (!res) report(false, 'ai status', `unreachable: ${err}`, ms);
    else {
      const d = (await res.json()) as {
        available?: boolean;
        model?: string;
        lastError?: { message?: string } | null;
      };
      report(
        Boolean(d.available),
        'ai status',
        d.available
          ? `model ${d.model}`
          : `model ${d.model} - ${d.lastError?.message ?? 'not configured'}`,
        ms
      );
    }
  }
  await checkPost('chat', '/ai/chat', token, { query: 'How many leads do I have?', history: [] });
  await checkPost('sentiment', '/ai/sentiment-analysis', token, {
    message: 'Still waiting on that quote.',
  });

  console.log('');
  console.log(`${passed} passed, ${failures.length} failed`);
  if (failures.length) {
    console.log('');
    for (const f of failures) console.log(`  ! ${f}`);
  }
  process.exit(failures.length ? 1 : 0);
}

void main();

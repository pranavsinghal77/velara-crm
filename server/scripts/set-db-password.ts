/**
 * Sets DATABASE_URL from a password typed at the terminal.
 *
 * The password never travels through a chat transcript, a shell history entry
 * or a command argument: it is read from stdin with echo off, held in memory
 * only long enough to prove a connection, and written to `.env` — which is
 * gitignored — and nowhere else. Nothing here logs it, and the confirmation
 * output is masked.
 *
 * It exists because the fiddly parts are easy to get wrong by hand:
 *
 *   - Supabase's "Direct connection string" is unreachable on most networks.
 *     `db.<ref>.supabase.co` resolves over IPv6 only unless the project has
 *     the IPv4 add-on, so the pooler host is the one that works.
 *   - The pooler needs `postgres.<project-ref>` as the username, not
 *     `postgres`. Using the direct string's username against the pooler fails
 *     with an authentication error that says nothing about the real cause.
 *   - Which regional pooler a project sits behind (`aws-0` or `aws-1`) is only
 *     visible in the dashboard, so this tries each and keeps the one that
 *     authenticates.
 *
 * Also the tool for rotating a password later, which is the same operation.
 *
 *   npm run db:set-password                 # prompts for everything it needs
 *   npm run db:set-password -- --ref <ref> --schema public
 */
import { spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline';
import fs from 'node:fs';
import path from 'node:path';
import { Client } from 'pg';

const ENV_PATH = path.resolve(__dirname, '..', '.env');

/** Pooler hostnames to try, in order, for a given region. */
const POOLER_HOSTS = (region: string) => [
  `aws-0-${region}.pooler.supabase.com`,
  `aws-1-${region}.pooler.supabase.com`,
];

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

/** Reads a line from stdin without echoing it. */
async function promptSecret(question: string): Promise<string> {
  const input = process.stdin;

  // No terminal means no echo to switch off — piped input, or a CI runner.
  // Reading it visibly and saying so beats the first version's behaviour,
  // which was to wait for a keypress that never came and exit 0 having
  // changed nothing.
  if (!input.isTTY) {
    console.warn('stdin is not a terminal, so the input below cannot be hidden.');
    return promptVisible(question);
  }

  process.stdout.write(question);

  const wasRaw = input.isRaw;
  input.setRawMode(true);
  input.resume();

  try {
    return await new Promise<string>((resolve) => {
      let buffer = '';

      const cleanup = () => {
        input.off('data', onData);
        input.off('end', onEnd);
      };

      // A chunk is not a keypress. Paste a password and the whole thing
      // arrives at once; hold a key and several characters do.
      const onData = (chunk: Buffer) => {
        for (const char of chunk.toString('utf8')) {
          if (char === '\r' || char === '\n') {
            cleanup();
            process.stdout.write('\n');
            resolve(buffer);
            return;
          }
          if (char === '\u0003') {
            cleanup();
            process.stdout.write('\n');
            process.exit(130);
          }
          if (char === '\u007f' || char === '\b') {
            buffer = buffer.slice(0, -1);
            continue;
          }
          // Ignore the remaining control characters rather than storing them
          // in a password.
          if (char < ' ') continue;

          buffer += char;
        }
      };

      const onEnd = () => {
        cleanup();
        process.stdout.write('\n');
        // Resolve rather than reject: an empty password is handled by the
        // caller, and it reports it properly.
        resolve(buffer);
      };

      input.on('data', onData);
      input.on('end', onEnd);
    });
  } finally {
    input.setRawMode(wasRaw);
    input.pause();
  }
}

/** Plain, echoing read. Used only where hiding the input is not possible. */
async function promptVisible(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise<string>((resolve) => rl.question(question, resolve));
  rl.close();
  return answer.trim();
}

async function promptLine(question: string, fallback: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise<string>((resolve) =>
    rl.question(`${question} [${fallback}]: `, resolve)
  );
  rl.close();
  return answer.trim() || fallback;
}

/**
 * Three outcomes, not two, because they need three different fixes:
 *
 *   rejected  - the pooler found the project and refused the credential
 *               (28P01). The host and username are right; the password is not.
 *   no-tenant - the pooler answered but does not serve this project (XX000,
 *               "tenant/user ... not found"). Wrong regional pooler, or wrong
 *               project ref. The password was never even tested.
 *   no-route  - the name did not resolve, or nothing answered.
 *
 * Collapsing the first two into "authentication failed" is what makes this
 * class of problem take an afternoon: you go looking for a bad password when
 * the password was never sent.
 */
type ProbeResult =
  | { ok: true }
  | { ok: false; kind: 'rejected' | 'no-tenant' | 'no-route'; message: string };

async function probe(url: string): Promise<ProbeResult> {
  const client = new Client({ connectionString: url, connectionTimeoutMillis: 12_000 });

  try {
    await client.connect();
    await client.query('select 1');
    return { ok: true };
  } catch (err) {
    const e = err as { message?: string; code?: string };
    const message = e.message ?? String(err);
    const code = e.code ?? '';

    // 28P01 is invalid_password. Supavisor reports an unknown project as XX000
    // with "tenant/user <user> not found" in the message.
    const kind =
      code === '28P01'
        ? 'rejected'
        : /tenant\/user .* not found|Tenant or user not found/i.test(message)
          ? 'no-tenant'
          : /ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ETIMEDOUT|timeout/i.test(message + code)
            ? 'no-route'
            : 'no-route';

    return { ok: false, kind, message };
  } finally {
    await client.end().catch(() => {});
  }
}

function mask(url: string): string {
  return url.replace(/:\/\/([^:]+):([^@]+)@/, '://$1:********@');
}

/**
 * Rewrites the two settings in place.
 *
 * The previous DATABASE_URL is kept as a commented line directly above, so a
 * bad cutover is one edit from being undone. Any line already commented out by
 * an earlier run is dropped, so they do not pile up.
 */
function writeEnv(url: string, schema: string) {
  const original = fs.readFileSync(ENV_PATH, 'utf8');
  const lines = original.split(/\r?\n/);

  const previous = lines.find((l) => l.startsWith('DATABASE_URL='));
  const out: string[] = [];
  let wroteUrl = false;

  for (const line of lines) {
    // Drop staged or superseded copies; the live values are re-emitted below.
    if (/^#\s*(DATABASE_URL|DB_SCHEMA)=/.test(line)) continue;
    if (line.startsWith('# Replaced by db:set-password')) continue;

    if (line.startsWith('DATABASE_URL=')) {
      if (previous) {
        out.push(`# Replaced by db:set-password on ${new Date().toISOString().slice(0, 10)}:`);
        out.push(`#${previous}`);
      }
      out.push(`DATABASE_URL="${url}"`);
      out.push(`DB_SCHEMA=${schema}`);
      wroteUrl = true;
      continue;
    }
    if (line.startsWith('DB_SCHEMA=')) continue;

    out.push(line);
  }

  if (!wroteUrl) {
    throw new Error('No DATABASE_URL line found in server/.env; refusing to guess where to put it.');
  }

  // Back the file up before overwriting. A mangled .env is a broken laptop.
  fs.copyFileSync(ENV_PATH, `${ENV_PATH}.bak`);
  fs.writeFileSync(ENV_PATH, out.join('\n').replace(/\n{3,}/g, '\n\n'));
}

async function main() {
  const ref = arg('ref') ?? (await promptLine('Supabase project ref', 'dfjooshpbxqjqgtitxxo'));
  const region = arg('region') ?? (await promptLine('Region', 'ap-south-1'));
  const schema = arg('schema') ?? (await promptLine('Postgres schema', 'public'));

  console.log(
    '\nThe database password is under Settings -> Database -> Database password.\n' +
      'It is shown only once at project creation; use "Reset database password"\n' +
      'if you no longer have it. Nothing you type below is echoed or logged.\n'
  );

  const password = await promptSecret('Database password: ');
  if (!password) {
    console.error('No password entered; nothing was changed.');
    process.exit(1);
  }

  const candidates = POOLER_HOSTS(region).map(
    (host) =>
      `postgresql://postgres.${ref}:${encodeURIComponent(password)}@${host}:5432/postgres`
  );

  let working: string | null = null;
  let rejected = false;

  const EXPLAIN: Record<'rejected' | 'no-tenant' | 'no-route', string> = {
    rejected: 'found this project, but refused the password',
    'no-tenant': 'answered, but does not serve this project',
    'no-route': 'could not be reached',
  };

  for (const url of candidates) {
    const host = new URL(url).hostname;
    process.stdout.write(`\n  ${host}\n    `);

    const result = await probe(url);
    if (result.ok) {
      console.log('connected, and the credentials work');
      working = url;
      break;
    }

    // Print the provider's own words as well as the interpretation. The first
    // version withheld them, and diagnosing anything then meant writing a
    // separate script to ask the same question again.
    console.log(`${EXPLAIN[result.kind]}\n    reported: ${result.message}`);
    if (result.kind === 'rejected') rejected = true;
  }

  if (!working) {
    console.error(
      rejected
        ? '\nThe project was found and the password was refused, so the host, the\n' +
            'project ref and the username are all correct — only the password is\n' +
            'wrong. Note that the database password is not your Supabase account\n' +
            'password: it is generated when the project is created and is separate.\n' +
            'Set a new one under Settings -> Database -> Reset database password,\n' +
            'then run this again. Nothing was changed.'
        : '\nNo pooler served this project, so the password was never tested.\n' +
            'Check the project ref and region, and confirm the pooler host under\n' +
            'Connect -> Connection pooling. Nothing was changed.'
    );
    process.exit(1);
  }

  writeEnv(working, schema);

  console.log(`\nserver/.env updated (previous value kept as a comment, backup at .env.bak)`);
  console.log(`  DATABASE_URL=${mask(working)}`);
  console.log(`  DB_SCHEMA=${schema}`);

  // A fresh project has no tables, so the migrations are the obvious next
  // step. Offered rather than run: it writes to a database, and that should be
  // a decision, not a side effect of setting a password.
  const status = spawnSync('npx', ['prisma', 'migrate', 'status'], {
    cwd: path.resolve(__dirname, '..'),
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });

  const pending = /migrations have not yet been applied|not yet been applied|No migration found/i.test(
    `${status.stdout ?? ''}${status.stderr ?? ''}`
  );

  console.log(
    pending
      ? '\nThis database has migrations outstanding. Apply them with:\n' +
          '  npm --prefix server run db:deploy\n' +
          '  SEED_PASSWORD="choose-a-long-one" npm --prefix server run db:seed'
      : '\nSchema is already up to date on this database.'
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

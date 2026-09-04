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
 * Tries to connect. Distinguishes "wrong password" from "wrong host", because
 * they need opposite fixes and the raw errors are easy to confuse.
 */
async function probe(url: string): Promise<{ ok: true } | { ok: false; authFailed: boolean; message: string }> {
  const client = new Client({ connectionString: url, connectionTimeoutMillis: 12_000 });

  try {
    await client.connect();
    await client.query('select 1');
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Postgres 28P01 is invalid_password; the pooler surfaces it as a plain
    // authentication failure. Either way the host was reachable.
    const authFailed = /password|authentication|28P01|Tenant or user not found/i.test(message);
    return { ok: false, authFailed, message };
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
  let sawAuthFailure = false;

  for (const url of candidates) {
    const host = new URL(url).hostname;
    process.stdout.write(`Trying ${host} ... `);

    const result = await probe(url);
    if (result.ok) {
      console.log('connected');
      working = url;
      break;
    }

    console.log(result.authFailed ? 'reachable, but rejected the password' : 'unreachable');
    if (result.authFailed) sawAuthFailure = true;
  }

  if (!working) {
    console.error(
      sawAuthFailure
        ? '\nThe host answered but the password was wrong. Nothing was changed.\n' +
            'Reset it under Settings -> Database and run this again.'
        : '\nNo pooler host could be reached, so the password was never tested.\n' +
            'Nothing was changed. Check the project ref and region, and confirm the\n' +
            'pooler host under Connect -> Connection pooling.'
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

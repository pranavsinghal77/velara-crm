/**
 * Grants or revokes cross-tenant platform-console access.
 *
 *   npm run platform:grant  -- admin@velara.com
 *   npm run platform:revoke -- admin@velara.com
 *   npm run platform:list
 *
 * This is deliberately a CLI, not an API endpoint or a checkbox in the app.
 * Platform access lets one account read every customer's data, so granting it
 * requires shell access to the deployment rather than a session in the product
 * — no sequence of in-app actions can escalate a tenant admin into an operator.
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import 'dotenv/config';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({
  adapter: new PrismaPg(pool, { schema: process.env.DB_SCHEMA || 'public' }),
});

type Action = 'grant' | 'revoke' | 'list';

async function main() {
  const action = (process.argv[2] ?? '') as Action;
  const email = process.argv[3]?.trim().toLowerCase();

  if (action === 'list') {
    const admins = await prisma.user.findMany({
      where: { isPlatformAdmin: true },
      select: { email: true, name: true, isActive: true, org: { select: { name: true } } },
      orderBy: { email: 'asc' },
    });

    if (admins.length === 0) {
      console.log('\nNo platform admins configured.\n');
      return;
    }

    console.log(`\n${admins.length} platform admin(s):\n`);
    for (const a of admins) {
      console.log(`  ${a.email.padEnd(32)} ${a.name} (${a.org.name})${a.isActive ? '' : ' [inactive]'}`);
    }
    console.log('');
    return;
  }

  if (action !== 'grant' && action !== 'revoke') {
    console.error(
      '\nUsage:\n' +
        '  npm run platform:grant  -- <email>\n' +
        '  npm run platform:revoke -- <email>\n' +
        '  npm run platform:list\n'
    );
    process.exitCode = 1;
    return;
  }

  if (!email) {
    console.error('\nAn email address is required.\n');
    process.exitCode = 1;
    return;
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true, isPlatformAdmin: true },
  });

  if (!user) {
    console.error(`\nNo user with email "${email}".\n`);
    process.exitCode = 1;
    return;
  }

  const target = action === 'grant';

  if (user.isPlatformAdmin === target) {
    console.log(`\n${user.email} is already ${target ? 'a platform admin' : 'not a platform admin'}.\n`);
    return;
  }

  // Revoking the last operator would lock the console permanently.
  if (!target) {
    const remaining = await prisma.user.count({
      where: { isPlatformAdmin: true, isActive: true, id: { not: user.id } },
    });
    if (remaining === 0) {
      console.error(
        '\nRefusing: this is the only active platform admin. Grant another before revoking this one.\n'
      );
      process.exitCode = 1;
      return;
    }
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { isPlatformAdmin: target },
  });

  // Existing access tokens carry no platform claim — the guard reads the flag
  // from the database on every request — so the change takes effect at once.
  console.log(
    `\n${target ? 'Granted' : 'Revoked'} platform console access ${target ? 'to' : 'from'} ${user.email}.\n`
  );
}

main()
  .catch((err) => {
    console.error('\nFailed:', err instanceof Error ? err.message : err, '\n');
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });

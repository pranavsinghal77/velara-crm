/**
 * Closes every billing period that has ended.
 *
 *   npm run billing:run              # dry run, prints what would be invoiced
 *   npm run billing:run -- --commit  # writes invoices
 *   npm run billing:run -- --commit --stripe   # and pushes them to Stripe
 *
 * Intended for a scheduler (cron, Cloud Scheduler, a platform job). Kept as a
 * script rather than a timer inside the API process so that running two API
 * instances cannot double-invoice a tenant.
 */
import 'dotenv/config';
import { closePeriod, buildInvoiceLines, findPeriodsDue } from '../src/billing/invoice.service';
import { formatPaise } from '../src/billing/plans';
import { prisma } from '../src/config/db';

const COMMIT = process.argv.includes('--commit');
const STRIPE = process.argv.includes('--stripe');

async function main() {
  const due = await findPeriodsDue();

  if (due.length === 0) {
    console.log('\nNo billing periods are due.\n');
    return;
  }

  console.log(`\n${due.length} period(s) due${COMMIT ? '' : '  [dry run]'}\n`);

  let total = 0;

  for (const row of due) {
    const org = await prisma.organization.findUnique({
      where: { id: row.orgId },
      select: { name: true },
    });

    if (COMMIT) {
      const result = await closePeriod(row.orgId, { pushToStripe: STRIPE });
      if (!result) continue;
      total += result.totalPaise;
      console.log(
        `  ${(org?.name ?? row.orgId).padEnd(28)} ${formatPaise(result.totalPaise).padStart(14)}` +
          `  invoice ${result.invoiceId}${result.stripeInvoiceId ? ` -> ${result.stripeInvoiceId}` : ''}`
      );
    } else {
      const preview = await buildInvoiceLines(row.orgId, row.currentPeriodStart, row.currentPeriodEnd);
      total += preview.totalPaise;
      console.log(`  ${(org?.name ?? row.orgId).padEnd(28)} ${formatPaise(preview.totalPaise).padStart(14)}`);
      for (const line of preview.lines) {
        console.log(`      ${line.description} — ${formatPaise(line.amountPaise)}`);
      }
    }
  }

  console.log(`\n  Total: ${formatPaise(total)}\n`);
  if (!COMMIT) console.log('  Nothing was written. Re-run with --commit to issue invoices.\n');
}

main()
  .catch((err) => {
    console.error('\nBilling run failed:', err instanceof Error ? err.message : err, '\n');
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

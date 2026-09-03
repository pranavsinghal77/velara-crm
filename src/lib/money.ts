import type { Lead } from '../types/models';

/**
 * One place for deal-value arithmetic.
 *
 * There were four separate inline parsers (three in Dashboard, one in
 * Analytics), all of the form:
 *
 *   parseFloat((lead.budget || '2').replace(/[^0-9.]/g, ''))
 *
 * which reads a bare rupee amount like "90000" as *90,000 lakhs* and invents
 * a 2 lakh default for leads with no budget. With one such lead in the demo
 * data the dashboard reported a pipeline of ₹90014.5L instead of ₹16.9L.
 *
 * The server now normalises `budget` into `budgetLakhs` on write, so that is
 * the authoritative number. The string parse remains only as a fallback for
 * optimistic rows that have not round-tripped yet, and it applies the same
 * rules as the server.
 */

/** Deal value in INR lakhs. Unparseable or absent budgets are worth 0, not 2. */
export function leadValueLakhs(lead: Pick<Lead, 'budget' | 'budgetLakhs'>): number {
  if (typeof lead.budgetLakhs === 'number' && Number.isFinite(lead.budgetLakhs)) {
    return lead.budgetLakhs;
  }
  return parseBudgetToLakhs(lead.budget);
}

/** Mirror of the server's `parseBudgetToLakhs`. */
export function parseBudgetToLakhs(budget?: string | null): number {
  if (!budget) return 0;

  const numeric = Number.parseFloat(budget.replace(/[^0-9.]/g, ''));
  if (!Number.isFinite(numeric) || numeric < 0) return 0;

  const lower = budget.toLowerCase();
  if (lower.includes('cr')) return numeric * 100;
  if (lower.includes('l')) return numeric;
  // A bare number is rupees.
  return numeric / 100_000;
}

export function sumLeadValueLakhs(leads: Pick<Lead, 'budget' | 'budgetLakhs'>[]): number {
  return leads.reduce((total, lead) => total + leadValueLakhs(lead), 0);
}

/** `₹1.2 Cr` above a crore, `₹16.9L` below it. */
export function formatLakhs(lakhs: number): string {
  if (!Number.isFinite(lakhs)) return '₹0L';
  return lakhs >= 100 ? `₹${(lakhs / 100).toFixed(1)} Cr` : `₹${lakhs.toFixed(1)}L`;
}

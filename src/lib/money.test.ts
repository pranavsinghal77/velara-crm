import { describe, expect, it } from 'vitest';
import { formatLakhs, leadValueLakhs, parseBudgetToLakhs, sumLeadValueLakhs } from './money';
import type { Lead } from '../types/models';

const lead = (budget?: string, budgetLakhs?: number) =>
  ({ budget, budgetLakhs }) as Pick<Lead, 'budget' | 'budgetLakhs'>;

describe('parseBudgetToLakhs', () => {
  it('reads lakh and crore suffixes', () => {
    expect(parseBudgetToLakhs('4.5L')).toBe(4.5);
    expect(parseBudgetToLakhs('₹2.8 L')).toBe(2.8);
    expect(parseBudgetToLakhs('1.2Cr')).toBe(120);
  });

  it('treats a bare number as rupees, not lakhs', () => {
    // The regression: the old inline parsers read this as 90,000 *lakhs*,
    // which made the dashboard report a ₹90014.5L pipeline instead of ₹16.9L.
    expect(parseBudgetToLakhs('90000')).toBeCloseTo(0.9);
    expect(parseBudgetToLakhs('250000')).toBeCloseTo(2.5);
  });

  it('is worth 0 when absent or unparseable, not a made-up default', () => {
    // The old parsers substituted 2 lakh for anything they could not read.
    expect(parseBudgetToLakhs(undefined)).toBe(0);
    expect(parseBudgetToLakhs('')).toBe(0);
    expect(parseBudgetToLakhs('to be discussed')).toBe(0);
    expect(Number.isNaN(parseBudgetToLakhs('???'))).toBe(false);
  });
});

describe('leadValueLakhs', () => {
  it('prefers the server-normalised value', () => {
    // budget says 90000, but the server already normalised it to 0.9.
    expect(leadValueLakhs(lead('90000', 0.9))).toBe(0.9);
  });

  it('falls back to parsing for an optimistic row with no server value yet', () => {
    expect(leadValueLakhs(lead('250000', undefined))).toBeCloseTo(2.5);
  });

  it('ignores a non-finite server value', () => {
    expect(leadValueLakhs(lead('4.5L', Number.NaN))).toBe(4.5);
  });
});

describe('sumLeadValueLakhs', () => {
  it('totals a mixed set the way the seeded pipeline does', () => {
    const leads = [
      lead('4.5L', 4.5),
      lead('2.8L', 2.8),
      lead('1.2L', 1.2),
      lead('6L', 6),
      lead('90000', 0.9),
      lead('1.5L', 1.5),
    ];
    expect(sumLeadValueLakhs(leads)).toBeCloseTo(16.9);
  });

  it('is 0 for an empty pipeline', () => {
    expect(sumLeadValueLakhs([])).toBe(0);
  });
});

describe('formatLakhs', () => {
  it('switches to crores at 100 lakhs', () => {
    expect(formatLakhs(16.9)).toBe('₹16.9L');
    expect(formatLakhs(99.9)).toBe('₹99.9L');
    expect(formatLakhs(120)).toBe('₹1.2 Cr');
  });

  it('does not render NaN at the user', () => {
    expect(formatLakhs(Number.NaN)).toBe('₹0L');
  });
});

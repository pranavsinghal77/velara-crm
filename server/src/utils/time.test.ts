import { describe, expect, it } from 'vitest';
import {
  fromDateAndTime,
  isToday,
  isTomorrow,
  toDateString,
  toTimeString,
} from './time';

/**
 * These cover the class of bug the old schema was working around by storing
 * `isToday` / `isTomorrow` as booleans: dates were plain strings interpreted
 * in whatever zone the reader happened to be in.
 */
describe('timezone-aware date handling (Asia/Kolkata)', () => {
  it('round-trips a wall-clock date and time', () => {
    const instant = fromDateAndTime('2026-03-10', '15:30');
    expect(toDateString(instant)).toBe('2026-03-10');
    expect(toTimeString(instant)).toBe('15:30');
  });

  it('stores IST wall-clock time as the correct UTC instant', () => {
    // 09:00 IST is 03:30 UTC (UTC+5:30).
    const instant = fromDateAndTime('2026-03-10', '09:00');
    expect(instant.toISOString()).toBe('2026-03-10T03:30:00.000Z');
  });

  it('keeps late-evening IST on the correct calendar day', () => {
    // 23:30 IST on the 10th is 18:00 UTC the same day; reading the UTC date
    // naively would be fine here, but the reverse case below is the trap.
    const instant = fromDateAndTime('2026-03-10', '23:30');
    expect(instant.toISOString()).toBe('2026-03-10T18:00:00.000Z');
    expect(toDateString(instant)).toBe('2026-03-10');
  });

  it('reports early-morning IST as the IST day, not the UTC day', () => {
    // 01:00 IST on the 11th is 19:30 UTC on the 10th. A UTC-based reader
    // would call this "the 10th" and show the reminder as overdue.
    const instant = fromDateAndTime('2026-03-11', '01:00');
    expect(instant.toISOString()).toBe('2026-03-10T19:30:00.000Z');
    expect(toDateString(instant)).toBe('2026-03-11');
  });

  it('defaults a missing time to 09:00 rather than midnight UTC', () => {
    expect(toTimeString(fromDateAndTime('2026-03-10'))).toBe('09:00');
  });

  it('rejects a malformed date instead of producing an Invalid Date', () => {
    expect(() => fromDateAndTime('not-a-date')).toThrow();
    expect(() => fromDateAndTime('2026-03-10', 'nonsense')).toThrow();
  });

  describe('isToday / isTomorrow', () => {
    const now = fromDateAndTime('2026-03-10', '12:00');

    it('identifies the same IST calendar day', () => {
      expect(isToday(fromDateAndTime('2026-03-10', '23:59'), now)).toBe(true);
      expect(isToday(fromDateAndTime('2026-03-10', '00:01'), now)).toBe(true);
      expect(isToday(fromDateAndTime('2026-03-11', '00:01'), now)).toBe(false);
    });

    it('identifies the next IST calendar day', () => {
      expect(isTomorrow(fromDateAndTime('2026-03-11', '09:00'), now)).toBe(true);
      expect(isTomorrow(fromDateAndTime('2026-03-10', '09:00'), now)).toBe(false);
      expect(isTomorrow(fromDateAndTime('2026-03-12', '09:00'), now)).toBe(false);
    });

    it('rolls over correctly across a month boundary', () => {
      const lastDayOfMarch = fromDateAndTime('2026-03-31', '20:00');
      expect(isTomorrow(fromDateAndTime('2026-04-01', '09:00'), lastDayOfMarch)).toBe(true);
    });

    it('rolls over correctly across a year boundary', () => {
      const newYearsEve = fromDateAndTime('2026-12-31', '20:00');
      expect(isTomorrow(fromDateAndTime('2027-01-01', '09:00'), newYearsEve)).toBe(true);
    });
  });
});

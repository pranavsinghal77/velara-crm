import { env } from '../config/env';

/**
 * Business dates are rendered in the organisation's timezone (Asia/Kolkata by
 * default) rather than UTC. Without this, a reminder set for 09:00 IST is
 * stored as 03:30 UTC and renders as "yesterday" for anyone reading the raw
 * date - which is exactly the class of bug that stored `isToday` booleans were
 * papering over.
 */

const TZ = env.APP_TIMEZONE;

interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

const partsFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

function zonedParts(date: Date): ZonedParts {
  const map: Record<string, string> = {};
  for (const { type, value } of partsFormatter.formatToParts(date)) {
    map[type] = value;
  }
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    // Intl can emit "24" for midnight in some engines/locales.
    hour: Number(map.hour) % 24,
    minute: Number(map.minute),
    second: Number(map.second),
  };
}

/** Offset in ms between the given instant and its wall-clock reading in TZ. */
function tzOffsetMs(timestamp: number): number {
  const p = zonedParts(new Date(timestamp));
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - timestamp;
}

/** `YYYY-MM-DD` as read in the app timezone. */
export function toDateString(date: Date): string {
  const p = zonedParts(date);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

/** `HH:mm` as read in the app timezone. */
export function toTimeString(date: Date): string {
  const p = zonedParts(date);
  return `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`;
}

/**
 * Turn a `YYYY-MM-DD` + `HH:mm` wall-clock pair in the app timezone into the
 * corresponding UTC instant. Two passes so the result is still correct when
 * the naive guess lands on the far side of a DST transition.
 */
export function fromDateAndTime(dateStr: string, timeStr = '09:00'): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [hh, mm] = timeStr.split(':').map(Number);

  if (!y || !m || !d || Number.isNaN(hh) || Number.isNaN(mm)) {
    throw new Error(`Invalid date/time: "${dateStr}" "${timeStr}"`);
  }

  const naive = Date.UTC(y, m - 1, d, hh, mm, 0, 0);
  let ts = naive - tzOffsetMs(naive);
  ts = naive - tzOffsetMs(ts);
  return new Date(ts);
}

/** Start of "today" in the app timezone, as a UTC instant. */
export function startOfToday(now = new Date()): Date {
  return fromDateAndTime(toDateString(now), '00:00');
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

export function isSameDay(a: Date, b: Date): boolean {
  return toDateString(a) === toDateString(b);
}

export function isToday(date: Date, now = new Date()): boolean {
  return isSameDay(date, now);
}

export function isTomorrow(date: Date, now = new Date()): boolean {
  // Add 24h to the *instant* then compare calendar days, so this stays right
  // across month and year boundaries.
  return isSameDay(date, addDays(now, 1));
}

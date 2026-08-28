export function daysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export function dateOffset(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

export function isoOffset(days: number, timeString: string): string {
  const d = dateOffset(days);
  const dateStr = d.toISOString().slice(0, 10);
  // Fix: use a valid default time if timeString is empty
  const time = timeString || '10:00:00';
  return `${dateStr}T${time}`;
}

export function shortDateOffset(days: number): string {
  const d = dateOffset(days);
  return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
}

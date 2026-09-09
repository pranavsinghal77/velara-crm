/**
 * Local UI preferences (theme, density, notification toggles).
 *
 * These live in the browser on purpose: they are per-device display choices,
 * not business records. Anything that belongs to the account goes through the
 * API instead.
 */

export function loadJson<T>(key: string, def: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : def;
  } catch {
    // Private-mode browsers throw on access; fall back to the default.
    return def;
  }
}

export function saveJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked - a lost preference is not worth an error.
  }
}

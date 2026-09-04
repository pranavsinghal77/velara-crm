import { API_BASE_URL } from './config';

/**
 * The single door to the API.
 *
 * Responsibilities that used to be scattered across the store and page
 * components (or simply absent):
 *
 *  - attaches the bearer token
 *  - keeps the access token in memory only, never localStorage, so an XSS bug
 *    cannot walk off with a long-lived credential
 *  - transparently refreshes an expired access token once, then replays the
 *    request
 *  - turns non-2xx responses into thrown `ApiError`s carrying the server's
 *    message, instead of `res.ok ? ... : []`
 */

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: { field: string; message: string }[];

  constructor(
    status: number,
    message: string,
    code = 'error',
    details?: { field: string; message: string }[]
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  /** True when the failure is the network/server being unreachable. */
  get isOffline() {
    return this.status === 0;
  }
}

// --- Access token (in-memory) ----------------------------------------------

let accessToken: string | null = null;
let onSessionLost: (() => void) | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

/** Registered by the store so a dead session can clear app state exactly once. */
export function setSessionLostHandler(handler: (() => void) | null) {
  onSessionLost = handler;
}

// --- Refresh coordination ---------------------------------------------------

let refreshInFlight: Promise<boolean> | null = null;

/**
 * Exchanges the httpOnly refresh cookie for a new access token. Concurrent
 * callers share one request so a page that fires five queries at once does not
 * trigger five rotations (which the server would treat as token reuse and
 * revoke the whole family).
 */
export function refreshSession(): Promise<boolean> {
  refreshInFlight ??= (async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });

      if (!res.ok) return false;

      const body = (await res.json()) as { accessToken?: string };
      if (!body.accessToken) return false;

      accessToken = body.accessToken;
      return true;
    } catch {
      return false;
    } finally {
      // Cleared as soon as this attempt settles. Callers that already have
      // the promise still await this same result; the next caller after it
      // settles starts a fresh attempt. (Deferring this to a later tick left
      // a stale success cached, so a subsequent 401 skipped its own refresh.)
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

// --- Core request -----------------------------------------------------------

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  signal?: AbortSignal;
  /** Internal: prevents a refresh loop. */
  _retried?: boolean;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query, signal, _retried = false } = options;

  const url = new URL(`${API_BASE_URL}${path}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== '') url.searchParams.set(key, String(value));
    }
  }

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers,
      credentials: 'include',
      signal,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    throw new ApiError(
      0,
      'Cannot reach the server. Check your connection and try again.',
      'network_error'
    );
  }

  // One refresh attempt, then replay. `_retried` stops this recursing.
  if (res.status === 401 && !_retried && !path.startsWith('/auth/')) {
    const refreshed = await refreshSession();
    if (refreshed) {
      return request<T>(path, { ...options, _retried: true });
    }
    accessToken = null;
    onSessionLost?.();
  }

  if (res.status === 204) return undefined as T;

  const payload = await res.json().catch(() => null);

  if (!res.ok) {
    const error = (payload as { error?: { message?: string; code?: string; details?: never } })
      ?.error;
    throw new ApiError(
      res.status,
      error?.message ?? `Request failed (${res.status})`,
      error?.code ?? 'error',
      error?.details
    );
  }

  return payload as T;
}

export const api = {
  get: <T>(path: string, opts?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...opts, method: 'GET' }),
  post: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...opts, method: 'POST', body }),
  put: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...opts, method: 'PUT', body }),
  delete: <T>(path: string, opts?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...opts, method: 'DELETE' }),
};

/** Shape of every list endpoint. */
export interface Paginated<T> {
  data: T[];
  nextCursor: string | null;
}

/**
 * Walks the cursor to load a bounded number of pages. Used for the initial
 * load, where the UI wants a working set rather than one page.
 */
export async function fetchAllPages<T>(
  path: string,
  query: Record<string, string | number | boolean | undefined> = {},
  maxPages = 5
): Promise<T[]> {
  const items: T[] = [];
  let cursor: string | null = null;

  for (let page = 0; page < maxPages; page += 1) {
    const res: Paginated<T> = await api.get<Paginated<T>>(path, {
      query: { ...query, limit: 100, ...(cursor ? { cursor } : {}) },
    });
    items.push(...res.data);
    cursor = res.nextCursor;
    if (!cursor) break;
  }

  return items;
}

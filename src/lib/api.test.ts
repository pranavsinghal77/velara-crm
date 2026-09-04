import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, api, setAccessToken, setSessionLostHandler } from './api';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('api client', () => {
  beforeEach(() => {
    setAccessToken(null);
    setSessionLostHandler(null);
  });

  afterEach(() => {
    setAccessToken(null);
  });

  it('attaches the bearer token when one is set', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ data: [] }));
    vi.stubGlobal('fetch', fetchMock);
    setAccessToken('token-abc');

    await api.get('/leads');

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer token-abc');
  });

  it('sends no Authorization header when unauthenticated', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ data: [] }));
    vi.stubGlobal('fetch', fetchMock);

    await api.get('/leads');

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it('throws ApiError carrying the server message and status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({ error: { code: 'forbidden', message: 'Requires Admin access' } }, 403)
      )
    );

    await expect(api.get('/users')).rejects.toMatchObject({
      name: 'ApiError',
      status: 403,
      code: 'forbidden',
      message: 'Requires Admin access',
    });
  });

  it('surfaces field-level validation details', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(
          {
            error: {
              code: 'bad_request',
              message: 'Validation failed',
              details: [{ field: 'email', message: 'Enter a valid email address' }],
            },
          },
          400
        )
      )
    );

    const err = await api.post('/leads', {}).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).details).toEqual([
      { field: 'email', message: 'Enter a valid email address' },
    ]);
  });

  it('reports a network failure as an offline ApiError, not a crash', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    const err = await api.get('/leads').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).isOffline).toBe(true);
  });

  it('refreshes once on 401 and replays the original request', async () => {
    const fetchMock = vi
      .fn()
      // 1. original request rejected
      .mockResolvedValueOnce(jsonResponse({ error: { message: 'expired' } }, 401))
      // 2. refresh succeeds
      .mockResolvedValueOnce(jsonResponse({ accessToken: 'fresh-token' }))
      // 3. replay succeeds
      .mockResolvedValueOnce(jsonResponse({ data: [{ id: 'lead-1' }] }));
    vi.stubGlobal('fetch', fetchMock);
    setAccessToken('stale-token');

    const result = await api.get<{ data: { id: string }[] }>('/leads');

    expect(result.data).toEqual([{ id: 'lead-1' }]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    // The replay must carry the new token, not the stale one.
    const replayInit = fetchMock.mock.calls[2]?.[1] as RequestInit;
    expect((replayInit.headers as Record<string, string>).Authorization).toBe(
      'Bearer fresh-token'
    );
  });

  it('gives up and reports session loss when the refresh also fails', async () => {
    const onLost = vi.fn();
    setSessionLostHandler(onLost);

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: { message: 'expired' } }, 401))
      .mockResolvedValueOnce(jsonResponse({ error: { message: 'no cookie' } }, 401));
    vi.stubGlobal('fetch', fetchMock);
    setAccessToken('stale-token');

    await expect(api.get('/leads')).rejects.toBeInstanceOf(ApiError);
    expect(onLost).toHaveBeenCalledTimes(1);
    // No retry storm: original + one refresh attempt.
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not attempt a refresh for a failed login', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ error: { message: 'Invalid email or password' } }, 401)
      );
    vi.stubGlobal('fetch', fetchMock);

    await expect(api.post('/auth/login', { email: 'a@b.com', password: 'x' })).rejects.toThrow(
      'Invalid email or password'
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('serialises query params and skips empty ones', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ data: [] }));
    vi.stubGlobal('fetch', fetchMock);

    await api.get('/leads', { query: { limit: 50, status: 'Won', search: undefined } });

    const url = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(url.searchParams.get('limit')).toBe('50');
    expect(url.searchParams.get('status')).toBe('Won');
    expect(url.searchParams.has('search')).toBe(false);
  });

  it('returns undefined for a 204 instead of failing to parse a body', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));

    await expect(api.delete('/leads/abc')).resolves.toBeUndefined();
  });
});

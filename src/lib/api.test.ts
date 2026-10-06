import { z } from 'zod';
import { ApiError, apiFetch } from './api';

vi.mock('./session', () => ({ getAccessToken: vi.fn(async () => 'tok-123') }));

describe('apiFetch', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('sends the bearer token and parses with the schema', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ code: 'ABC234' }), { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiFetch('/rooms', z.object({ code: z.string() }), { method: 'POST', body: '{}' })).resolves.toEqual({ code: 'ABC234' });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://api.test/rooms');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok-123');
  });

  it('maps the backend error body to ApiError', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ code: 'ROOM_FULL', message: 'Sala cheia' }), { status: 409 })));
    await expect(apiFetch('/rooms/X', z.unknown())).rejects.toMatchObject({ status: 409, code: 'ROOM_FULL', message: 'Sala cheia' });
  });

  it('turns network failures into ApiError', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))));
    await expect(apiFetch('/me', z.unknown())).rejects.toBeInstanceOf(ApiError);
  });
});

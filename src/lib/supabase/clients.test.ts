import { getAccessToken } from '@/lib/session';
import { createClient } from './client';
import { createServerSupabase } from './server';

const createBrowserClient = vi.fn();
const createServerClient = vi.fn();
const getSession = vi.fn();
const cookieStore = { getAll: vi.fn(() => [{ name: 'a', value: '1' }]), set: vi.fn() };

vi.mock('@supabase/ssr', () => ({
  createBrowserClient: (...args: unknown[]) => createBrowserClient(...args),
  createServerClient: (...args: unknown[]) => createServerClient(...args),
}));
vi.mock('next/headers', () => ({ cookies: async () => cookieStore }));

type CookieAdapter = { getAll(): unknown; setAll(c: { name: string; value: string; options: object }[]): void };

describe('supabase clients', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createBrowserClient.mockReturnValue({ auth: { getSession } });
  });

  it('browser client uses the public env', () => {
    createClient();
    expect(createBrowserClient).toHaveBeenCalledWith('https://test.supabase.local', 'sb_publishable_test');
  });

  it('server client reads and writes the request cookies', async () => {
    await createServerSupabase();
    const { cookies } = createServerClient.mock.calls[0][2] as { cookies: CookieAdapter };
    expect(cookies.getAll()).toEqual([{ name: 'a', value: '1' }]);
    cookies.setAll([{ name: 'b', value: '2', options: { path: '/' } }]);
    expect(cookieStore.set).toHaveBeenCalledWith('b', '2', { path: '/' });
  });

  it('server client ignores cookie writes from Server Components', async () => {
    cookieStore.set.mockImplementationOnce(() => {
      throw new Error('read-only');
    });
    await createServerSupabase();
    const { cookies } = createServerClient.mock.calls[0][2] as { cookies: CookieAdapter };
    expect(() => cookies.setAll([{ name: 'b', value: '2', options: {} }])).not.toThrow();
  });

  it('getAccessToken returns the current access token or null', async () => {
    getSession.mockResolvedValueOnce({ data: { session: { access_token: 'tok' } } });
    await expect(getAccessToken()).resolves.toBe('tok');
    getSession.mockResolvedValueOnce({ data: { session: null } });
    await expect(getAccessToken()).resolves.toBeNull();
  });
});

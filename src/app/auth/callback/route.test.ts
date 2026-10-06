// @vitest-environment node
import { GET } from './route';

const exchangeCodeForSession = vi.fn(async () => ({ error: null }));
vi.mock('@/lib/supabase/server', () => ({
  createServerSupabase: async () => ({ auth: { exchangeCodeForSession } }),
}));

describe('GET /auth/callback', () => {
  it('exchanges the code and redirects to a safe next', async () => {
    const res = await GET(new Request('http://localhost:3000/auth/callback?code=abc&next=/ABC234'));
    expect(exchangeCodeForSession).toHaveBeenCalledWith('abc');
    expect(res.headers.get('location')).toBe('http://localhost:3000/ABC234');
  });

  it('ignores an external next', async () => {
    const res = await GET(new Request('http://localhost:3000/auth/callback?code=abc&next=//evil.com'));
    expect(res.headers.get('location')).toBe('http://localhost:3000/');
  });

  it('forwards provider errors to the error page', async () => {
    const res = await GET(new Request('http://localhost:3000/auth/callback?error=server_error&error_code=identity_already_exists'));
    expect(res.headers.get('location')).toBe('http://localhost:3000/auth/erro?code=identity_already_exists');
  });

  it('sends a failed exchange to the error page', async () => {
    exchangeCodeForSession.mockResolvedValueOnce({ error: new Error('bad') } as never);
    const res = await GET(new Request('http://localhost:3000/auth/callback?code=bad'));
    expect(res.headers.get('location')).toBe('http://localhost:3000/auth/erro?code=exchange_failed');
  });
});

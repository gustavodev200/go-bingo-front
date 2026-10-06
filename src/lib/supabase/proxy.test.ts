// @vitest-environment node
import { NextRequest } from 'next/server';
import { updateSession } from './proxy';

let claims: object | null = null;
let cookiesFromSupabase: { name: string; value: string; options: object }[] = [];

vi.mock('@supabase/ssr', () => ({
  createServerClient: (_url: string, _key: string, { cookies }: { cookies: { setAll: (c: typeof cookiesFromSupabase, h: Record<string, string>) => void } }) => ({
    auth: {
      getClaims: async () => {
        if (cookiesFromSupabase.length) cookies.setAll(cookiesFromSupabase, { 'Cache-Control': 'private, no-store' });
        return { data: claims ? { claims } : null };
      },
    },
  }),
}));

describe('updateSession', () => {
  beforeEach(() => {
    claims = null;
    cookiesFromSupabase = [];
  });

  it('sends anonymous visitors to /login keeping path and query', async () => {
    const res = await updateSession(new NextRequest('http://localhost:3000/ranking?x=1'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://localhost:3000/login?next=%2Franking%3Fx%3D1');
  });

  it('lets public routes through without a session', async () => {
    for (const path of ['/login', '/auth/callback', '/auth/erro']) {
      const res = await updateSession(new NextRequest(`http://localhost:3000${path}`));
      expect(res.headers.get('location')).toBeNull();
    }
  });

  it('lets signed-in users through and forwards refreshed cookies', async () => {
    claims = { sub: 'user-1' };
    cookiesFromSupabase = [{ name: 'sb-token', value: 'new', options: { path: '/' } }];
    const res = await updateSession(new NextRequest('http://localhost:3000/ABC234'));
    expect(res.headers.get('location')).toBeNull();
    expect(res.cookies.get('sb-token')?.value).toBe('new');
    expect(res.headers.get('cache-control')).toBe('private, no-store');
  });
});

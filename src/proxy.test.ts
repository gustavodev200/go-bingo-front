// @vitest-environment node
import { NextRequest } from 'next/server';
import { config, proxy } from './proxy';

const updateSession = vi.fn<(req: NextRequest) => Promise<Response>>(async () => new Response(null));
vi.mock('@/lib/supabase/proxy', () => ({ updateSession: (req: NextRequest) => updateSession(req) }));

describe('proxy', () => {
  it('delegates to updateSession', async () => {
    const req = new NextRequest('http://localhost:3000/');
    await proxy(req);
    expect(updateSession).toHaveBeenCalledWith(req);
  });

  it('skips static assets', () => {
    const matcher = new RegExp(`^${config.matcher[0]}$`);
    expect(matcher.test('/ABC234')).toBe(true);
    expect(matcher.test('/_next/static/chunk.js')).toBe(false);
    expect(matcher.test('/icon.png')).toBe(false);
  });
});

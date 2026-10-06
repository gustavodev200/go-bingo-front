// @vitest-environment node
import { renderToString } from 'react-dom/server';
import { LoginPanel } from './login-panel';

vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({ auth: {} }) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn() }) }));

const INSTAGRAM_ANDROID = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Instagram 300.0.0.0';

describe('LoginPanel server render', () => {
  it('never bakes a localhost Chrome intent into the HTML', () => {
    const html = renderToString(<LoginPanel userAgent={INSTAGRAM_ANDROID} next="/" />);
    expect(html).toContain('Abra no navegador');
    expect(html).not.toContain('intent://localhost');
  });
});

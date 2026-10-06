import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginPanel } from './login-panel';

const signInWithOAuth = vi.fn(async () => ({ error: null }));
const signInAnonymously = vi.fn(async () => ({ error: null }));
const replace = vi.fn();

vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({ auth: { signInWithOAuth, signInAnonymously } }) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace, push: vi.fn() }) }));
vi.mock('@marsidev/react-turnstile', () => ({
  Turnstile: ({ onSuccess }: { onSuccess: (t: string) => void }) => <button onClick={() => onSuccess('captcha-ok')}>captcha</button>,
}));

const CHROME = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36';
const INSTAGRAM = 'Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 Instagram 300.0.0.0';

describe('LoginPanel', () => {
  beforeEach(() => vi.clearAllMocks());

  it('starts Google OAuth keeping the destination', async () => {
    render(<LoginPanel userAgent={CHROME} next="/ABC234" />);
    await userEvent.click(screen.getByRole('button', { name: /entrar com google/i }));
    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback?next=%2FABC234` },
    });
  });

  it('signs in as guest after the captcha and goes to nickname', async () => {
    render(<LoginPanel userAgent={CHROME} next="/ABC234" />);
    await userEvent.click(screen.getByRole('button', { name: /jogar como convidado/i }));
    await userEvent.click(screen.getByRole('button', { name: 'captcha' }));
    expect(signInAnonymously).toHaveBeenCalledWith({ options: { captchaToken: 'captcha-ok' } });
    expect(replace).toHaveBeenCalledWith('/apelido?next=%2FABC234');
  });

  it('in-app browser: hides Google, explains, keeps guest', () => {
    render(<LoginPanel userAgent={INSTAGRAM} next="/" />);
    expect(screen.queryByRole('button', { name: /entrar com google/i })).not.toBeInTheDocument();
    expect(screen.getByText(/abra no navegador/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /copiar link/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /jogar como convidado/i })).toBeInTheDocument();
  });
});

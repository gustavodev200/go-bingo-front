import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginPanel } from './login-panel';

const signInWithOAuth = vi.fn();
const signInAnonymously = vi.fn();
const replace = vi.fn();
const toastError = vi.fn();
const toastSuccess = vi.fn();

vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({ auth: { signInWithOAuth, signInAnonymously } }) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));
vi.mock('sonner', () => ({ toast: { error: (m: string) => toastError(m), success: (m: string) => toastSuccess(m) } }));
vi.mock('@marsidev/react-turnstile', () => ({
  Turnstile: ({ onSuccess }: { onSuccess: (t: string) => void }) => <button onClick={() => onSuccess('captcha-ok')}>captcha</button>,
}));

const CHROME = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36';
const INSTAGRAM_ANDROID = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Instagram 300.0.0.0';
const INSTAGRAM_IOS = 'Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 Instagram 300.0.0.0';

describe('LoginPanel errors and in-app helpers', () => {
  beforeEach(() => vi.clearAllMocks());

  it('tells the user when Google sign-in fails', async () => {
    signInWithOAuth.mockResolvedValueOnce({ error: new Error('x') });
    render(<LoginPanel userAgent={CHROME} next="/" />);
    await userEvent.click(screen.getByRole('button', { name: /entrar com google/i }));
    expect(toastError).toHaveBeenCalledWith('Não foi possível entrar com Google. Tente novamente.');
  });

  it('returns to the guest button when the anonymous sign-in fails', async () => {
    signInAnonymously.mockResolvedValueOnce({ error: new Error('captcha') });
    render(<LoginPanel userAgent={CHROME} next="/" />);
    await userEvent.click(screen.getByRole('button', { name: /jogar como convidado/i }));
    await userEvent.click(screen.getByRole('button', { name: 'captcha' }));
    expect(toastError).toHaveBeenCalledWith('Não foi possível entrar como convidado. Tente novamente.');
    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /jogar como convidado/i })).toBeInTheDocument();
  });

  it('copies the link inside in-app browsers', async () => {
    const user = userEvent.setup();
    render(<LoginPanel userAgent={INSTAGRAM_IOS} next="/" />);
    await user.click(screen.getByRole('button', { name: /copiar link/i }));
    await expect(navigator.clipboard.readText()).resolves.toBe(window.location.href);
    expect(toastSuccess).toHaveBeenCalledWith('Link copiado! Cole no Chrome ou Safari.');
    expect(screen.queryByRole('link', { name: /abrir no chrome/i })).not.toBeInTheDocument();
  });

  it('offers a Chrome intent on Android in-app browsers', () => {
    render(<LoginPanel userAgent={INSTAGRAM_ANDROID} next="/" />);
    expect(screen.getByRole('link', { name: /abrir no chrome/i }).getAttribute('href')).toMatch(/^intent:\/\/localhost.*package=com\.android\.chrome;end$/);
  });
});

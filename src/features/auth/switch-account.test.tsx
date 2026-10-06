import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SwitchToGoogleAccount } from './upgrade-button';

const calls: string[] = [];
const signOut = vi.fn(async () => {
  calls.push('signOut');
});
const signInWithOAuth = vi.fn<(options: unknown) => Promise<void>>(async () => {
  calls.push('signInWithOAuth');
});
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({ auth: { signOut, signInWithOAuth } }) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => '/' }));

describe('SwitchToGoogleAccount', () => {
  it('discards the guest session and signs into the existing Google account', async () => {
    render(<SwitchToGoogleAccount />);
    await userEvent.click(screen.getByRole('button', { name: /entrar na conta google existente/i }));
    expect(calls).toEqual(['signOut', 'signInWithOAuth']);
    expect(signInWithOAuth).toHaveBeenCalledWith({ provider: 'google', options: { redirectTo: `${window.location.origin}/auth/callback?next=%2F` } });
  });
});

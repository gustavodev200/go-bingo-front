import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UpgradeButton } from './upgrade-button';

const linkIdentity = vi.fn();
const push = vi.fn();
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({ auth: { linkIdentity } }) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }), usePathname: () => '/ABC234' }));

describe('UpgradeButton', () => {
  beforeEach(() => vi.clearAllMocks());

  it('links Google returning to the current page', async () => {
    linkIdentity.mockResolvedValue({ data: {}, error: null });
    render(<UpgradeButton />);
    await userEvent.click(screen.getByRole('button', { name: /entrar com google para salvar/i }));
    expect(linkIdentity).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback?next=%2FABC234` },
    });
  });

  it('identity_already_exists goes to the explanation page', async () => {
    linkIdentity.mockResolvedValue({ data: null, error: { code: 'identity_already_exists', message: 'x' } });
    render(<UpgradeButton />);
    await userEvent.click(screen.getByRole('button', { name: /entrar com google para salvar/i }));
    expect(push).toHaveBeenCalledWith('/auth/error?code=identity_already_exists');
  });
});

describe('UpgradeButton other errors', () => {
  it('toasts unexpected link errors without navigating', async () => {
    linkIdentity.mockResolvedValue({ data: null, error: { code: 'unexpected_failure', message: 'x' } });
    render(<UpgradeButton />);
    await userEvent.click(screen.getByRole('button', { name: /entrar com google para salvar/i }));
    expect(push).not.toHaveBeenCalled();
  });
});

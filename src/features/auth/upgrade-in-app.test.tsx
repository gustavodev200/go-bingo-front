import { render, screen } from '@testing-library/react';
import { SwitchToGoogleAccount, UpgradeButton } from './upgrade-button';

vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({ auth: {} }) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => '/ABC234' }));

describe('Google upgrade inside in-app browsers', () => {
  beforeEach(() => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 Instagram 300.0.0.0');
  });
  afterEach(() => vi.restoreAllMocks());

  it('UpgradeButton asks to open the browser instead of starting Google OAuth', () => {
    render(<UpgradeButton />);
    expect(screen.queryByRole('button', { name: /entrar com google/i })).not.toBeInTheDocument();
    expect(screen.getByText(/abra no navegador/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /copiar link/i })).toBeInTheDocument();
  });

  it('SwitchToGoogleAccount does the same', () => {
    render(<SwitchToGoogleAccount />);
    expect(screen.queryByRole('button', { name: /conta google existente/i })).not.toBeInTheDocument();
    expect(screen.getByText(/abra no navegador/i)).toBeInTheDocument();
  });
});

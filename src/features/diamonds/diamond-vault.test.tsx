import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DiamondVault } from './diamond-vault';

const apiFetch = vi.fn();
const refresh = vi.fn().mockResolvedValue(undefined);
let isGuest = false;
vi.mock('@/lib/api', async (orig) => ({ ...(await orig<typeof import('@/lib/api')>()), apiFetch: (...a: unknown[]) => apiFetch(...a) }));
vi.mock('@/features/profile/profile-context', () => ({
  useProfile: () => ({ profile: { id: 'u1', nickname: 'Ana', character: null, isGuest, points: 0, coins: 100, diamonds: 0 }, refresh }),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const status = (over = {}) => ({ diamonds: 12, coins: 100, streakDay: 2, claimedToday: false, nextReward: 10, eligible: true, ...over });

describe('DiamondVault', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isGuest = false;
  });

  it('shows the balance, the 7-day track and claims today', async () => {
    apiFetch.mockResolvedValueOnce(status()).mockResolvedValueOnce({ claimed: 10, status: status({ diamonds: 22, streakDay: 3, claimedToday: true }) });
    render(<DiamondVault />);
    const claim = await screen.findByRole('button', { name: /resgatar 10 diamantes/i });
    expect(screen.getByRole('list', { name: 'Sequência: 2 de 7 dias' })).toBeInTheDocument();
    await userEvent.click(claim);
    expect(apiFetch).toHaveBeenLastCalledWith('/diamonds/claim', expect.anything(), { method: 'POST' });
    expect(await screen.findByRole('button', { name: /volte amanhã/i })).toBeDisabled();
    expect(refresh).toHaveBeenCalled();
  });

  it('exchanges a pack it can afford; bigger packs show their bonus', async () => {
    apiFetch.mockResolvedValueOnce(status()).mockResolvedValueOnce({ coins: 550, status: status({ diamonds: 2 }) });
    render(<DiamondVault />);
    await screen.findByRole('button', { name: /resgatar/i });
    expect(screen.getByRole('button', { name: 'Trocar 50 diamantes por 3000 moedas' })).toBeDisabled();
    expect(screen.getByText('+10%')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Trocar 10 diamantes por 550 moedas' }));
    await waitFor(() => expect(apiFetch).toHaveBeenLastCalledWith('/diamonds/exchange', expect.anything(), { method: 'POST', body: JSON.stringify({ diamonds: 10 }) }));
  });

  it('guests are invited to sign in instead', () => {
    isGuest = true;
    apiFetch.mockResolvedValue(status({ eligible: false }));
    render(<DiamondVault />);
    expect(screen.getByText(/entre com sua conta/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /resgatar/i })).not.toBeInTheDocument();
  });
});

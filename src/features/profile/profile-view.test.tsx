import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ProfileStats } from '@/contracts';
import { CoinHistory } from './coin-history';
import { ProfileView } from './profile-view';
import { StatsGrid } from './stats-grid';

const logout = vi.fn();
const reload = vi.fn();
let isGuest = false;
let statsState: { state: 'loading' | 'error' | 'ok'; stats: ProfileStats | null; reload: () => void };

vi.mock('@/features/profile/profile-context', () => ({
  useProfile: () => ({ profile: { id: '00000000-0000-4000-8000-000000000001', nickname: 'Ana', isGuest, points: 20, coins: 980 }, refresh: vi.fn() }),
}));
vi.mock('@/features/auth/use-logout', () => ({ useLogout: () => logout }));
vi.mock('@/features/auth/upgrade-button', () => ({ UpgradeButton: () => <button>upgrade</button> }));
vi.mock('./use-profile-stats', () => ({ useProfileStats: () => statsState }));

const stats: ProfileStats = {
  gamesPlayed: 12,
  wins: 3,
  points: 60,
  rank: 7,
  coinHistory: [
    { id: '00000000-0000-4000-8000-0000000000c1', amount: 200, reason: 'WIN', createdAt: '2026-10-07T15:00:00.000Z' },
    { id: '00000000-0000-4000-8000-0000000000c2', amount: -5, reason: 'CARD', createdAt: '2026-10-07T14:00:00.000Z' },
  ],
};

describe('StatsGrid', () => {
  it('shows games, wins, points and rank', () => {
    render(<StatsGrid stats={stats} isGuest={false} />);
    expect(screen.getByText('Partidas').nextSibling).toHaveTextContent('12');
    expect(screen.getByText('Vitórias').nextSibling).toHaveTextContent('3');
    expect(screen.getByText('Pontos').nextSibling).toHaveTextContent('60');
    expect(screen.getByText('Ranking').nextSibling).toHaveTextContent('7º');
  });

  it('explains a missing rank for guests and for who never played', () => {
    const { rerender } = render(<StatsGrid stats={{ ...stats, rank: null }} isGuest />);
    expect(screen.getByText('Ranking').nextSibling).toHaveTextContent('—');
    expect(screen.getByText(/convidados não entram no ranking/i)).toBeInTheDocument();
    rerender(<StatsGrid stats={{ ...stats, rank: null, gamesPlayed: 0 }} isGuest={false} />);
    expect(screen.getByText(/jogue uma partida para entrar no ranking/i)).toBeInTheDocument();
  });
});

describe('CoinHistory', () => {
  it('labels every movement with its reason and signed amount', () => {
    render(<CoinHistory entries={stats.coinHistory} />);
    const items = screen.getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('Vitória');
    expect(items[0]).toHaveTextContent('+200');
    expect(items[1]).toHaveTextContent('Cartela');
    expect(items[1]).toHaveTextContent('−5');
  });

  it('says when there is nothing yet', () => {
    render(<CoinHistory entries={[]} />);
    expect(screen.getByText('Nenhuma movimentação ainda.')).toBeInTheDocument();
  });

  it('knows every reason', () => {
    render(
      <CoinHistory
        entries={(['WELCOME', 'DAILY', 'CARD', 'WIN', 'LOSS'] as const).map((reason, i) => ({ id: `00000000-0000-4000-8000-00000000000${i}`, amount: 1, reason, createdAt: '2026-10-07T12:00:00.000Z' }))}
      />,
    );
    for (const label of ['Boas-vindas', 'Bônus do dia', 'Cartela', 'Vitória', 'Derrota']) expect(screen.getByText(label)).toBeInTheDocument();
  });
});

describe('ProfileView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isGuest = false;
    statsState = { state: 'ok', stats, reload };
  });

  it('shows nickname, balance, stats and history; logs out', async () => {
    render(<ProfileView />);
    expect(screen.getByRole('heading', { name: 'Seu perfil' })).toBeInTheDocument();
    expect(screen.getByText('Ana')).toBeInTheDocument();
    expect(screen.getByText('980')).toBeInTheDocument();
    expect(screen.getByText('Vitórias')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Extrato de moedas' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'upgrade' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /sair da conta/i }));
    expect(logout).toHaveBeenCalled();
  });

  it('guests get the upgrade CTA', () => {
    isGuest = true;
    render(<ProfileView />);
    expect(screen.getByRole('button', { name: 'upgrade' })).toBeInTheDocument();
  });

  it('loading and error states; retry reloads', async () => {
    statsState = { state: 'loading', stats: null, reload };
    const { rerender } = render(<ProfileView />);
    expect(screen.getByText(/carregando estatísticas/i)).toBeInTheDocument();
    statsState = { state: 'error', stats: null, reload };
    rerender(<ProfileView />);
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(reload).toHaveBeenCalled();
  });
});

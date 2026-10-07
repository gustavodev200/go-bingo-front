import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { RoomSnapshot } from '@/contracts';
import { ResultDialog } from './result-dialog';
import { initialGameState, reduce, useGameStore } from './store';

const ME = '00000000-0000-4000-8000-000000000001';
const ANA = '00000000-0000-4000-8000-000000000002';
const grid = Array.from({ length: 25 }, (_, i) => (i === 12 ? 0 : i + 1));
let isGuest = false;
let points = 20;

vi.mock('@/features/profile/profile-context', () => ({
  useProfile: () => ({ profile: { id: ME, nickname: 'Eu', isGuest, points: 0, coins: 100 }, refresh: vi.fn() }),
}));
vi.mock('@/features/auth/upgrade-button', () => ({ UpgradeButton: () => <button>upgrade</button> }));

function setup(hostId: string, winnerId: string | null, drawn: number[] = [], { spectator = false, reason = 'exhausted' as 'exhausted' | 'no_players' } = {}) {
  const snapshot: RoomSnapshot = {
    code: 'ABC234', name: 'Sala', hostId, maxPlayers: 10, isPublic: true, status: 'IN_GAME', winPattern: 'FULL_CARD',
    members: [], myCard: spectator ? null : { id: '00000000-0000-4000-8000-0000000000aa', grid, marked: [] }, game: { id: '00000000-0000-4000-8000-0000000000bb', drawn, drawIntervalMs: 5000, remaining: {} },
  };
  let state = reduce(initialGameState(ME), { event: 'room:state', payload: snapshot });
  state = winnerId
    ? reduce(state, { event: 'game:won', payload: { userId: winnerId, nickname: winnerId === ME ? 'Eu' : 'Ana', pointsAwarded: winnerId === ME && !isGuest ? points : 0, coinsAwarded: 100, grid } })
    : reduce(state, { event: 'game:ended', payload: { reason } });
  useGameStore.setState(state);
}

describe('ResultDialog', () => {
  beforeEach(() => {
    isGuest = false;
    points = 20;
  });

  it('registered winner sees the points', () => {
    setup(ME, ME);
    render(<ResultDialog onReplay={vi.fn()} onLeave={vi.fn()} />);
    expect(screen.getByText(/você venceu/i)).toBeInTheDocument();
    expect(screen.getByText(/\+20 pontos/i)).toBeInTheDocument();
  });

  it('registered winner who only beat guests learns why there are no points', () => {
    points = 0;
    setup(ME, ME);
    render(<ResultDialog onReplay={vi.fn()} onLeave={vi.fn()} />);
    expect(screen.getByText(/só vitória contra outro jogador logado pontua/i)).toBeInTheDocument();
  });

  it('winner sees the coins won; others see the coins lost', () => {
    setup(ME, ME);
    const { unmount } = render(<ResultDialog onReplay={vi.fn()} onLeave={vi.fn()} />);
    expect(screen.getByRole('dialog')).toHaveTextContent('+100 moedas');
    unmount();
    setup(ANA, ANA);
    render(<ResultDialog onReplay={vi.fn()} onLeave={vi.fn()} />);
    expect(screen.getByRole('dialog')).toHaveTextContent('−20 moedas');
  });

  it('guest winner sees the upgrade CTA', () => {
    isGuest = true;
    setup(ME, ME);
    render(<ResultDialog onReplay={vi.fn()} onLeave={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'upgrade' })).toBeInTheDocument();
  });

  it('others see who won; only the host can replay', async () => {
    const onReplay = vi.fn();
    setup(ANA, ANA);
    render(<ResultDialog onReplay={onReplay} onLeave={vi.fn()} />);
    expect(screen.getByText(/ana fez bingo/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /jogar de novo/i })).not.toBeInTheDocument();
  });

  it('host can replay after a game without winner', async () => {
    const onReplay = vi.fn();
    setup(ME, null);
    render(<ResultDialog onReplay={onReplay} onLeave={vi.fn()} />);
    expect(screen.getByText(/sem vencedor/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /jogar de novo/i }));
    expect(onReplay).toHaveBeenCalled();
  });

  it("shows the winner's card with the drawn numbers stamped", () => {
    setup(ME, ANA, [1, 2, 3, 4, 5]);
    render(<ResultDialog onReplay={vi.fn()} onLeave={vi.fn()} />);
    expect(screen.getByRole('group', { name: 'Cartela de Ana' })).toBeInTheDocument();
    expect(screen.getByLabelText('B 1, sorteado')).toBeInTheDocument();
    expect(screen.getByLabelText('B 6')).toBeInTheDocument();
  });

  it('no winner, no card', () => {
    setup(ME, null);
    render(<ResultDialog onReplay={vi.fn()} onLeave={vi.fn()} />);
    expect(screen.queryByRole('group')).not.toBeInTheDocument();
  });

  it('spectator sees who won, loses nothing and learns they play next round', () => {
    setup(ANA, ANA, [], { spectator: true });
    render(<ResultDialog onReplay={vi.fn()} onLeave={vi.fn()} />);
    expect(screen.getByText(/ana fez bingo/i)).toBeInTheDocument();
    expect(screen.getByRole('dialog')).not.toHaveTextContent('moedas');
    expect(screen.getByText(/você entra na próxima rodada/i)).toBeInTheDocument();
  });

  it('explains a game that ended because every player left', () => {
    setup(ME, null, [], { reason: 'no_players' });
    render(<ResultDialog onReplay={vi.fn()} onLeave={vi.fn()} />);
    expect(screen.getByText(/todos os jogadores com cartela saíram/i)).toBeInTheDocument();
  });
});

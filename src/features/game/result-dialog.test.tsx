import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { RoomSnapshot } from '@/contracts';
import { ResultDialog } from './result-dialog';
import { initialGameState, reduce, useGameStore } from './store';

const ME = '00000000-0000-4000-8000-000000000001';
const ANA = '00000000-0000-4000-8000-000000000002';
const grid = Array.from({ length: 25 }, (_, i) => (i === 12 ? 0 : i + 1));
let isGuest = false;

vi.mock('@/features/profile/profile-context', () => ({
  useProfile: () => ({ profile: { id: ME, nickname: 'Eu', isGuest, points: 0 }, refresh: vi.fn() }),
}));
vi.mock('@/features/auth/upgrade-button', () => ({ UpgradeButton: () => <button>upgrade</button> }));

function setup(hostId: string, winnerId: string | null) {
  const snapshot: RoomSnapshot = {
    code: 'ABC234', name: 'Sala', hostId, maxPlayers: 10, isPublic: true, status: 'IN_GAME',
    members: [], myCard: null, game: { id: '00000000-0000-4000-8000-0000000000bb', drawn: [], drawIntervalMs: 5000, remaining: {} },
  };
  let state = reduce(initialGameState(ME), { event: 'room:state', payload: snapshot });
  state = winnerId
    ? reduce(state, { event: 'game:won', payload: { userId: winnerId, nickname: winnerId === ME ? 'Eu' : 'Ana', pointsAwarded: winnerId === ME && !isGuest ? 20 : 0, grid } })
    : reduce(state, { event: 'game:ended', payload: { reason: 'exhausted' } });
  useGameStore.setState(state);
}

describe('ResultDialog', () => {
  beforeEach(() => {
    isGuest = false;
  });

  it('registered winner sees the points', () => {
    setup(ME, ME);
    render(<ResultDialog onReplay={vi.fn()} onLeave={vi.fn()} />);
    expect(screen.getByText(/você venceu/i)).toBeInTheDocument();
    expect(screen.getByText(/\+20 pontos/i)).toBeInTheDocument();
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
});

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { RoomSnapshot } from '@/contracts';
import { GameView } from './game-view';
import { initialGameState, reduce, useGameStore } from './store';

const ME = '00000000-0000-4000-8000-000000000001';
const grid = Array.from({ length: 25 }, (_, i) => (i === 12 ? 0 : i + 1));

function load(marked: number[]) {
  const snapshot: RoomSnapshot = {
    code: 'ABC234', name: 'Sala', hostId: ME, maxPlayers: 10, isPublic: true, status: 'IN_GAME',
    members: [{ userId: ME, nickname: 'Eu', slot: 0, isGuest: false, connected: true, hasCard: true }],
    myCard: { id: '00000000-0000-4000-8000-0000000000aa', grid, marked },
    game: { id: '00000000-0000-4000-8000-0000000000bb', drawn: grid.filter((n) => n !== 0), drawIntervalMs: 5000, remaining: { [ME]: 0 } },
  };
  useGameStore.setState(reduce(initialGameState(ME), { event: 'room:state', payload: snapshot }));
}

const actions = { generateCard: vi.fn(), start: vi.fn(), cancel: vi.fn(), leave: vi.fn(), kick: vi.fn(), mark: vi.fn(), claim: vi.fn(), replay: vi.fn() };

describe('GameView', () => {
  beforeEach(() => vi.clearAllMocks());

  it('keeps BINGO disabled until every cell is marked', () => {
    load([0, 1]);
    render(<GameView actions={actions} />);
    expect(screen.getByRole('button', { name: /bingo/i })).toBeDisabled();
  });

  it('enables BINGO and claims', async () => {
    load(Array.from({ length: 25 }, (_, i) => i).filter((i) => i !== 12));
    render(<GameView actions={actions} />);
    await userEvent.click(screen.getByRole('button', { name: /bingo/i }));
    expect(actions.claim).toHaveBeenCalled();
  });

  it('marks through the actions', async () => {
    load([]);
    render(<GameView actions={actions} />);
    await userEvent.click(screen.getByRole('button', { name: 'B 1, sorteado' }));
    expect(actions.mark).toHaveBeenCalledWith(0);
  });
});

import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { RoomSnapshot } from '@/contracts';
import { RoomScreen } from './room-screen';
import { useGameStore } from './store';

const ME = '00000000-0000-4000-8000-000000000001';
const ANA = '00000000-0000-4000-8000-000000000002';
const grid = Array.from({ length: 25 }, (_, i) => (i === 12 ? 0 : i + 1));

const push = vi.fn();
const toast = vi.fn();
const actions = { generateCard: vi.fn(), start: vi.fn(), cancel: vi.fn(), leave: vi.fn(async () => undefined), kick: vi.fn(), mark: vi.fn(), claim: vi.fn(), replay: vi.fn() };

vi.mock('next/navigation', () => ({ useRouter: () => ({ push }), usePathname: () => '/ABC234' }));
vi.mock('sonner', () => ({ toast: Object.assign((msg: string) => toast(msg), { error: vi.fn(), success: vi.fn() }) }));
vi.mock('@/features/profile/profile-context', () => ({
  useProfile: () => ({ profile: { id: ME, nickname: 'Eu', isGuest: false, points: 0 }, refresh: vi.fn() }),
}));
vi.mock('./use-game-connection', () => ({ useGameConnection: () => actions }));

function room(overrides: Partial<RoomSnapshot> = {}): RoomSnapshot {
  return {
    code: 'ABC234', name: 'Amigos', hostId: ME, maxPlayers: 10, isPublic: true, status: 'WAITING',
    members: [
      { userId: ME, nickname: 'Eu', slot: 0, isGuest: false, connected: true, hasCard: false },
      { userId: ANA, nickname: 'Ana', slot: 1, isGuest: true, connected: true, hasCard: true },
    ],
    myCard: null, game: null,
    ...overrides,
  };
}

/** Renderiza (o effect zera a store) e então entrega o snapshot como o socket faria. */
function renderWith(snapshot: RoomSnapshot | null) {
  const view = render(<RoomScreen code="ABC234" />);
  if (snapshot) act(() => useGameStore.getState().dispatch({ event: 'room:state', payload: snapshot }));
  return view;
}

describe('RoomScreen', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows a loading state until the snapshot arrives', () => {
    renderWith(null);
    expect(screen.getByText(/entrando na sala/i)).toBeInTheDocument();
  });

  it('shows the lobby with the reconnecting banner', () => {
    renderWith(room());
    expect(screen.getByRole('heading', { name: 'Amigos' })).toBeInTheDocument();
    act(() => useGameStore.getState().setConnection('reconnecting'));
    expect(screen.getByText(/reconectando…/i)).toBeInTheDocument();
  });

  it('non-host leaves the room and goes home', async () => {
    renderWith(room({ hostId: ANA }));
    await userEvent.click(screen.getByRole('button', { name: /sair da sala/i }));
    expect(actions.leave).toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith('/');
  });

  it('shows the game while in progress and announces players one away', () => {
    renderWith(room({ status: 'IN_GAME', myCard: { id: '00000000-0000-4000-8000-0000000000aa', grid, marked: [] }, game: { id: '00000000-0000-4000-8000-0000000000bb', drawn: [5], drawIntervalMs: 5000, remaining: { [ME]: 3, [ANA]: 2 } } }));
    expect(screen.getByRole('button', { name: /bingo/i })).toBeInTheDocument();
    act(() => useGameStore.getState().dispatch({ event: 'game:progress', payload: { remaining: { [ME]: 1, [ANA]: 1 } } }));
    expect(toast).toHaveBeenCalledWith('Você está por 1!');
    expect(toast).toHaveBeenCalledWith('Ana está por 1!');
  });

  it('shows the result dialog after a win and replays', async () => {
    renderWith(room({ status: 'IN_GAME', game: { id: '00000000-0000-4000-8000-0000000000bb', drawn: [], drawIntervalMs: 5000, remaining: {} } }));
    act(() => useGameStore.getState().dispatch({ event: 'game:won', payload: { userId: ANA, nickname: 'Ana', pointsAwarded: 0, grid } }));
    expect(screen.getByText(/ana fez bingo/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /jogar de novo/i }));
    expect(actions.replay).toHaveBeenCalled();
  });

  it('explains why the player left the room', () => {
    renderWith(room());
    act(() => useGameStore.getState().dispatch({ event: 'room:closed', payload: { reason: 'host_cancelled' } }));
    expect(screen.getByRole('alert')).toHaveTextContent('A sala foi encerrada pelo host.');
    act(() => useGameStore.getState().setExit({ reason: 'error', message: 'Sua sessão expirou. Entre de novo.' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Sua sessão expirou');
  });
});

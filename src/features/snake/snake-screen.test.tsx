import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { SnakeRoomState } from '@/contracts';
import type { SnakeActions } from './connection';
import { QualityGovernor } from './media/renderer';
import { PublicRooms } from './public-rooms';
import { SnakeArt } from './snake-art';
import { SnakeHome } from './snake-home';
import { SnakeRoomScreen } from './snake-screen';
import { useSnakeStore } from './store';

const ME = '00000000-0000-4000-8000-000000000001';
const push = vi.fn();
const replace = vi.fn();
const createSnakeRoom = vi.fn();
let publicRooms: unknown = [];
let actions: SnakeActions;

vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace }) }));
vi.mock('@/features/profile/profile-pill', () => ({ ProfilePill: () => null }));
vi.mock('./connection', () => ({
  useSnakeRoom: () => actions,
  createSnakeRoom: (isPublic: boolean) => createSnakeRoom(isPublic),
  usePublicSnakeRooms: () => publicRooms,
}));
vi.mock('@/features/profile/profile-context', () => ({
  useProfile: () => ({ profile: { id: ME, nickname: 'Ana', character: 'c03', isGuest: false, points: 0, coins: 0 } }),
}));
vi.mock('./media/audio', () => ({ unlockAudio: vi.fn(), sfx: vi.fn(), isMuted: () => false, toggleMute: () => true }));
vi.mock('./media/renderer', async (orig) => ({
  ...(await orig<typeof import('./media/renderer')>()),
  SnakeRenderer: vi.fn(),
  drawSkinPreview: vi.fn(),
  drawMinimap: vi.fn(),
}));

const DEATH = { killer: 'Naja', score: 120, kills: 2, rank: 3, secs: 75 };
const room = (extra: Partial<SnakeRoomState> = {}): SnakeRoomState => ({
  code: 'ABC234',
  isPublic: true,
  hostId: ME,
  players: [
    { userId: ME, nickname: 'Ana', character: null, connected: true, playing: false },
    { userId: 'u2', nickname: 'Bia', character: null, connected: true, playing: true },
  ],
  version: 1,
  ...extra,
});

beforeEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
  localStorage.clear();
  publicRooms = [];
  actions = { play: vi.fn().mockResolvedValue(null), leave: vi.fn().mockResolvedValue(undefined), setVisibility: vi.fn().mockResolvedValue(undefined), input: vi.fn(), viewSize: vi.fn() };
  useSnakeStore.getState().reset();
  useSnakeStore.getState().joined({ state: room(), radius: 2000, meta: [] });
});

describe('SnakeRoomScreen', () => {
  it('waits for a second player before anyone can play', () => {
    useSnakeStore.getState().applyState(room({ version: 2, players: [{ userId: ME, nickname: 'Ana', character: null, connected: true, playing: false }, { userId: 'u2', nickname: 'Bia', character: null, connected: false, playing: false }] }));
    render(<SnakeRoomScreen code="ABC234" />);
    expect(screen.getByRole('status')).toHaveTextContent('Aguardando jogadores (1/2)');
    expect(screen.getByRole('button', { name: 'Jogar' })).toBeDisabled();
  });

  it('death card waits too when the room is down to one player', () => {
    vi.useFakeTimers();
    render(<SnakeRoomScreen code="ABC234" />);
    act(() => {
      useSnakeStore.getState().applyState(room({ version: 3, players: [{ userId: ME, nickname: 'Ana', character: null, connected: true, playing: false }] }));
      useSnakeStore.getState().died(DEATH);
    });
    act(() => vi.advanceTimersByTime(1200));
    expect(screen.getByRole('button', { name: 'Aguardando jogadores…' })).toBeDisabled();
  });

  it('menu: room code, players, skin picker remembered, play with the chosen skin', async () => {
    const user = userEvent.setup();
    render(<SnakeRoomScreen code="ABC234" />);
    expect(screen.getByText('ABC234')).toBeInTheDocument();
    expect(screen.getByText('2/20')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Jogadores na sala' })).toHaveTextContent('Bia');
    expect(screen.getByLabelText('Anfitrião')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Próxima skin' }));
    await user.click(screen.getByRole('button', { name: 'Próxima skin' }));
    await user.click(screen.getByRole('button', { name: 'Skin anterior' }));
    expect(screen.getByRole('img', { name: 'Skin 2 de 12' })).toBeInTheDocument();
    expect(localStorage.getItem('snake.skin')).toBe('1');
    await user.click(screen.getByRole('button', { name: 'Jogar' }));
    expect(actions.play).toHaveBeenCalledWith(1);
  });

  it('host toggles visibility; everybody can leave the room', async () => {
    const user = userEvent.setup();
    render(<SnakeRoomScreen code="ABC234" />);
    await user.click(screen.getByRole('button', { name: 'Pública' }));
    expect(actions.setVisibility).toHaveBeenCalledWith(false);
    await user.click(screen.getByRole('button', { name: /sair da sala/i }));
    expect(actions.leave).toHaveBeenCalled();
    act(() => useSnakeStore.getState().setExit({ reason: 'left', message: 'Você saiu da sala' }));
    expect(replace).toHaveBeenCalledWith('/snake');
  });

  it('guests see the visibility but cannot change it; share copies the link', async () => {
    useSnakeStore.getState().applyState(room({ hostId: 'u2', isPublic: false, version: 2 }));
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    render(<SnakeRoomScreen code="ABC234" />);
    expect(screen.getByText('Sala privada')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Privada' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Compartilhar sala' }));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('/snake/ABC234'));
    expect(await screen.findByText('Link copiado!')).toBeInTheDocument();
  });

  it('shows why it could not play', async () => {
    actions.play = vi.fn().mockResolvedValue('Você não está em uma sala');
    render(<SnakeRoomScreen code="ABC234" />);
    await userEvent.click(screen.getByRole('button', { name: 'Jogar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Você não está em uma sala');
  });

  it('waits for the room while joining or reconnecting', () => {
    useSnakeStore.getState().reset();
    const { rerender } = render(<SnakeRoomScreen code="ABC234" />);
    expect(screen.getByText('Entrando na sala…')).toBeInTheDocument();
    act(() => useSnakeStore.getState().setConnection('reconnecting'));
    rerender(<SnakeRoomScreen code="ABC234" />);
    expect(screen.getAllByText(/reconectando/i).length).toBeGreaterThan(0);
  });

  it('playing: HUD with leaderboard, my rank, feed and controls', async () => {
    useSnakeStore.getState().playing(7);
    useSnakeStore.getState().setLeaderboard({
      top: Array.from({ length: 10 }, (_, i) => ({ id: i + 100, name: `Cobra${i}`, score: 500 - i })),
      dots: [[0, 0]],
      total: 20,
      rank: 14,
      me: { score: 40, kills: 3, x: 0, y: 0 },
    });
    useSnakeStore.getState().pushFeed('Cobra0', 'Cobra9');
    render(<SnakeRoomScreen code="ABC234" />);
    expect(screen.queryByRole('button', { name: 'Jogar' })).not.toBeInTheDocument();
    const board = screen.getByRole('list', { name: 'Ranking' });
    expect(board).toHaveTextContent('1. Cobra0');
    expect(board).toHaveTextContent('14. Você');
    expect(screen.getByText('14/20')).toBeInTheDocument();
    expect(screen.getByText('eliminou')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Desligar som' }));
    expect(screen.getByRole('button', { name: 'Ligar som' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Sair da sala' }));
    expect(actions.leave).toHaveBeenCalled();
  });

  it('touch: stick steers and the boost button holds boost', () => {
    useSnakeStore.getState().playing(7);
    render(<SnakeRoomScreen code="ABC234" />);
    fireEvent.pointerDown(window, { pointerType: 'touch' });
    const stick = screen.getByLabelText('Analógico');
    fireEvent.pointerDown(stick, { pointerId: 1, clientX: 50, clientY: 50 });
    fireEvent.pointerMove(stick, { pointerId: 1, clientX: 150, clientY: 50 });
    fireEvent.pointerMove(stick, { pointerId: 2, clientX: 0, clientY: 0 });
    fireEvent.pointerUp(stick, { pointerId: 1 });
    const boost = screen.getByRole('button', { name: 'Impulso' });
    fireEvent.pointerDown(boost);
    expect(boost).toHaveAttribute('aria-pressed', 'true');
    fireEvent.pointerUp(boost);
    expect(boost).toHaveAttribute('aria-pressed', 'false');
  });

  it('death: summary after a moment, new record, play again or back to menu', async () => {
    vi.useFakeTimers();
    useSnakeStore.getState().playing(7);
    render(<SnakeRoomScreen code="ABC234" />);
    act(() => useSnakeStore.getState().died(DEATH));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1200));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('Eliminado por Naja!');
    expect(dialog).toHaveTextContent('1m 15s');
    expect(dialog).toHaveTextContent('Novo recorde pessoal');
    expect(localStorage.getItem('snake.best')).toBe('120');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Jogar de novo' }));
    });
    expect(actions.play).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    expect(screen.getByRole('button', { name: 'Jogar' })).toBeInTheDocument();
    expect(screen.getByText(/seu recorde: 120/i)).toBeInTheDocument();
  });

  it('death by the border without beating the record', () => {
    vi.useFakeTimers();
    localStorage.setItem('snake.best', '999');
    render(<SnakeRoomScreen code="ABC234" />);
    act(() => useSnakeStore.getState().died({ ...DEATH, killer: null, secs: 9 }));
    act(() => vi.advanceTimersByTime(1200));
    expect(screen.getByRole('dialog')).toHaveTextContent('Você bateu na borda!');
    expect(screen.getByRole('dialog')).toHaveTextContent('Recorde: 999');
  });

  it('exits: room not found or full go back to the lobby', () => {
    useSnakeStore.getState().setExit({ reason: 'full', message: 'A sala está cheia' });
    render(<SnakeRoomScreen code="ABC234" />);
    expect(screen.getByRole('heading', { name: 'Sala cheia' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /voltar ao lobby/i })).toHaveAttribute('href', '/snake');
  });
});

describe('SnakeHome', () => {
  it('creates a public or private room and opens it', async () => {
    const user = userEvent.setup();
    createSnakeRoom.mockResolvedValue({ ok: true, data: { state: { code: 'XYZ789' } } });
    render(<SnakeHome />);
    await user.click(screen.getByRole('radio', { name: /privada/i }));
    await user.click(screen.getByRole('button', { name: 'Criar sala' }));
    expect(createSnakeRoom).toHaveBeenCalledWith(false);
    expect(push).toHaveBeenCalledWith('/snake/XYZ789');
  });

  it('shows create errors and validates the code before joining', async () => {
    const user = userEvent.setup();
    createSnakeRoom.mockResolvedValue({ ok: false, error: { code: 'INVALID_STATE', message: 'Muitas salas' } });
    render(<SnakeHome />);
    await user.click(screen.getByRole('button', { name: 'Criar sala' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Muitas salas');
    await user.type(screen.getByLabelText('Código da sala'), 'abc');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(screen.getByRole('alert')).toHaveTextContent('6 letras');
    await user.clear(screen.getByLabelText('Código da sala'));
    await user.type(screen.getByLabelText('Código da sala'), 'abc234');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(push).toHaveBeenCalledWith('/snake/ABC234');
  });

  it('lists public rooms', () => {
    publicRooms = null;
    const { rerender } = render(<PublicRooms />);
    expect(screen.getByText('Procurando salas…')).toBeInTheDocument();
    publicRooms = [];
    rerender(<PublicRooms />);
    expect(screen.getByText(/nenhuma sala pública/i)).toBeInTheDocument();
    publicRooms = [{ code: 'ABC234', hostNickname: 'Ana', hostCharacter: null, players: 7 }];
    rerender(<PublicRooms />);
    expect(screen.getByRole('link', { name: 'Entrar na sala de Ana, 7 de 20 jogadores' })).toHaveAttribute('href', '/snake/ABC234');
  });

  it('renders the card art', () => {
    const { container } = render(<SnakeArt />);
    expect(container.firstChild).toHaveAttribute('aria-hidden');
  });
});

describe('QualityGovernor', () => {
  it('drops quality on slow or heavy frames, goes back up slowly and backs off', () => {
    const g = new QualityGovernor(2);
    const run = (n: number, interval: number, work: number) => {
      for (let i = 0; i < n; i++) g.sample(interval, work);
    };
    run(60, 40, 6); // late frames
    expect(g.level).toBe(1);
    run(200, 16, 20); // heavy frames
    expect(g.level).toBe(0);
    // capped at ~31 ms per frame but drawing takes 3 ms: room to go back up (after 2 drops: 32 s)
    run(1100, 31, 3);
    expect(g.level).toBe(1);
    expect(g.sample(16, 4)).toBe(false);
  });
});

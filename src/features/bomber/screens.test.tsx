import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { frame, roomState, seatPlayer, userId } from '@/test/bomber-fixtures';
import { BomberArt } from './bomber-art';
import { BomberHome } from './bomber-home';
import type { BomberActions, BomberListeners } from './connection';
import { PublicRooms } from './public-rooms';
import { nextFreeColor, RoomLobby } from './room-lobby';
import { BomberRoomScreen } from './room-screen';
import { useBomberStore } from './store';

const push = vi.fn();
const replace = vi.fn();
const createBomberRoom = vi.fn();
let publicRooms: unknown = [];
let listeners: BomberListeners;
let actions: BomberActions;

vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace }) }));
vi.mock('@/features/profile/profile-pill', () => ({ ProfilePill: () => null }));
vi.mock('./connection', () => ({
  createBomberRoom: (isPublic: boolean) => createBomberRoom(isPublic),
  usePublicBomberRooms: () => publicRooms,
  useBomberRoom: (_code: string, l: BomberListeners) => {
    listeners = l;
    return actions;
  },
}));
vi.mock('./media/audio', () => ({
  unlockAudio: vi.fn(),
  startMusic: vi.fn(),
  stopMusic: vi.fn(),
  setMusicFast: vi.fn(),
  sfx: vi.fn(),
  isMuted: () => false,
  toggleMute: () => true,
}));

function fakeActions(): BomberActions {
  const ok = () => vi.fn().mockResolvedValue(true);
  return { leave: ok(), ready: ok(), setRules: ok(), setVisibility: ok(), setStake: ok(), setColor: ok(), addBot: ok(), removeBot: ok(), start: ok(), rematch: ok(), input: vi.fn() };
}

beforeEach(() => {
  vi.clearAllMocks();
  publicRooms = [];
  actions = fakeActions();
  useBomberStore.getState().reset();
});

describe('BomberHome', () => {
  it('creates a private room and opens it', async () => {
    createBomberRoom.mockResolvedValue({ ok: true, data: { state: roomState({ code: 'QWE234' }), mySeat: 0, frame: null } });
    render(<BomberHome />);
    await userEvent.click(screen.getByRole('radio', { name: /Privada/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Criar sala' }));
    expect(createBomberRoom).toHaveBeenCalledWith(false);
    expect(push).toHaveBeenCalledWith('/bomber/QWE234');
  });

  it('shows why a room could not be created and joins by code', async () => {
    createBomberRoom.mockResolvedValue({ ok: false, error: { code: 'INVALID_STATE', message: 'Você já está na sala ABC234' } });
    render(<BomberHome />);
    await userEvent.click(screen.getByRole('button', { name: 'Criar sala' }));
    expect(screen.getByRole('alert')).toHaveTextContent('ABC234');
    await userEvent.type(screen.getByLabelText('Código da sala'), 'abc');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(screen.getByRole('alert')).toHaveTextContent('6 letras');
    await userEvent.clear(screen.getByLabelText('Código da sala'));
    await userEvent.type(screen.getByLabelText('Código da sala'), 'xyz234');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(push).toHaveBeenCalledWith('/bomber/XYZ234');
  });
});

describe('PublicRooms', () => {
  it('shows loading, empty and the live list', () => {
    publicRooms = null;
    const { rerender } = render(<PublicRooms />);
    expect(screen.getByText('Procurando salas…')).toBeInTheDocument();
    publicRooms = [];
    rerender(<PublicRooms />);
    expect(screen.getByText(/Nenhuma sala pública/)).toBeInTheDocument();
    publicRooms = [
      { code: 'ABC234', hostNickname: 'Ana', hostCharacter: null, players: 3, rules: { winsToWin: 1 } },
      { code: 'DEF234', hostNickname: 'Bia', hostCharacter: null, players: 1, rules: { winsToWin: 3 } },
    ];
    rerender(<PublicRooms />);
    expect(screen.getByRole('link', { name: /sala de Ana, 3 de 8/ })).toHaveAttribute('href', '/bomber/ABC234');
    expect(screen.getByText('1 vitória')).toBeInTheDocument();
    expect(screen.getByText('3 vitórias')).toBeInTheDocument();
  });
});

it('BomberArt draws a decorative arena', () => {
  const { container } = render(<BomberArt />);
  expect(container.firstElementChild).toHaveAttribute('aria-hidden');
  expect(container.textContent).toContain('💣');
});

describe('RoomLobby', () => {
  const lobby = (over = {}) =>
    roomState({
      phase: 'LOBBY',
      lobbyStatus: 'WAITING_PLAYERS',
      seats: [seatPlayer(0, { ready: true }), seatPlayer(1, { color: 2 }), seatPlayer(2, { bot: true, ready: true, userId: 'cpu:1', nickname: 'CPU 1', color: 1 }), null, null, null, null, null],
      ...over,
    });

  it('host picks colors, wins, visibility, CPUs and starts', async () => {
    render(<RoomLobby state={lobby({ lobbyStatus: 'READY_TO_START' })} mySeat={0} actions={actions} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(8);
    await userEvent.click(screen.getByRole('button', { name: 'Próxima cor' }));
    expect(actions.setColor).toHaveBeenCalledWith(3);
    await userEvent.click(screen.getByRole('button', { name: 'Cor anterior' }));
    expect(actions.setColor).toHaveBeenCalledWith(7);
    await userEvent.click(screen.getByRole('radio', { name: '1' }));
    expect(actions.setRules).toHaveBeenCalledWith({ winsToWin: 1 });
    await userEvent.click(screen.getByRole('button', { name: /Pública/ }));
    expect(actions.setVisibility).toHaveBeenCalledWith(false);
    await userEvent.click(screen.getAllByRole('button', { name: /\+ CPU/ })[0]);
    expect(actions.addBot).toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Tirar CPU 1' }));
    expect(actions.removeBot).toHaveBeenCalledWith(2);
    await userEvent.click(screen.getByRole('button', { name: /Pronto!/ }));
    expect(actions.ready).toHaveBeenCalledWith(false);
    await userEvent.click(screen.getByRole('button', { name: /INICIAR/ }));
    expect(actions.start).toHaveBeenCalled();
    expect(screen.getByText(/Toque em INICIAR/)).toBeInTheDocument();
  });

  it('guests only see their own controls and the waiting hints', async () => {
    render(<RoomLobby state={lobby({ isPublic: false, seats: [seatPlayer(0), seatPlayer(1, { connected: false, reconnectDeadline: Date.now() + 9000 }), null, null, null, null, null, null] })} mySeat={1} actions={actions} />);
    expect(screen.queryByRole('button', { name: /INICIAR/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /\+ CPU/ })).not.toBeInTheDocument();
    expect(screen.getAllByText('Aguardando…').length).toBeGreaterThan(0);
    expect(screen.getByText(/confirme que está pronto/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Estou pronto' }));
    expect(actions.ready).toHaveBeenCalledWith(true);
    await userEvent.click(screen.getByRole('button', { name: 'Sair da sala' }));
    expect(actions.leave).toHaveBeenCalled();
  });

  it('shares the room link', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    render(<RoomLobby state={lobby({ seats: [seatPlayer(0), null, null, null, null, null, null, null] })} mySeat={0} actions={actions} />);
    expect(screen.getByText(/adicione CPU/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Compartilhar sala' }));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('/bomber/ABC234'));
  });

  it('nextFreeColor skips taken colors and gives up when all are taken', () => {
    const s = lobby();
    expect(nextFreeColor(s, 0, 1)).toBe(3);
    const full = roomState({ seats: Array.from({ length: 8 }, (_, i) => seatPlayer(i)) });
    expect(nextFreeColor(full, 0, 1)).toBeNull();
  });
});

describe('BomberRoomScreen', () => {
  const playing = () => roomState({ seats: [seatPlayer(0), seatPlayer(1), null, null, null, null, null, null] });

  it('shows loading, exit screens and leaves to the lobby', () => {
    render(<BomberRoomScreen code="ABC234" />);
    expect(screen.getByRole('status')).toHaveTextContent('Entrando na sala');
    act(() => useBomberStore.getState().setConnection('reconnecting'));
    expect(screen.getAllByRole('status')[0]).toHaveTextContent('Reconectando');
    act(() => useBomberStore.getState().setExit({ reason: 'full', message: 'A sala está cheia' }));
    expect(screen.getByRole('heading', { name: 'Sala cheia' })).toBeInTheDocument();
    act(() => useBomberStore.getState().setExit({ reason: 'left', message: '' }));
    expect(replace).toHaveBeenCalledWith('/bomber');
  });

  it('tells me when I was removed from the room', () => {
    render(<BomberRoomScreen code="ABC234" />);
    act(() => useBomberStore.getState().applySnapshot({ state: playing(), mySeat: 0, frame: null }));
    const gone = playing();
    gone.version = 9;
    gone.seats = [null, seatPlayer(1), null, null, null, null, null, null];
    act(() => useBomberStore.getState().applyState(gone));
    expect(screen.getByRole('heading', { name: 'Não deu para entrar' })).toBeInTheDocument();
  });

  it('shows the lobby, then the arena with scoreboard, banners and results', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
    render(<BomberRoomScreen code="ABC234" />);
    act(() => useBomberStore.getState().applySnapshot({ state: roomState({ phase: 'LOBBY', lobbyStatus: 'WAITING_PLAYERS' }), mySeat: 0, frame: null }));
    expect(screen.getByRole('heading', { name: 'BATALHA MULTIPLAYER' })).toBeInTheDocument();

    act(() => useBomberStore.getState().applyState({ ...playing(), version: 3 }));
    act(() => listeners.onFrame(frame({ phase: 'countdown', phaseLeft: 1 })));
    expect(screen.getByText('PRONTO?')).toBeInTheDocument();
    act(() => listeners.onAnnouncement({ event: 'bomber:round_started', payload: { seq: 1, roundNumber: 1 } }));
    expect(screen.getByText('RODADA 1')).toBeInTheDocument();
    act(() => listeners.onFrame(frame({ events: [{ k: 'go' }, { k: 'boom', x: 1, y: 1 }], timeLeft: 30, players: [[0, 1, 1, 2, 0, 1, 3.4, 'slow', 0, 0, 2, 3, 1, 7]] })));
    expect(screen.getByText('VAI!')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(800));
    expect(screen.queryByText('VAI!')).not.toBeInTheDocument();
    const scoreboard = screen.getByRole('list', { name: 'Placar' });
    expect(within(scoreboard).getAllByRole('listitem')).toHaveLength(2);

    act(() => listeners.onAnnouncement({ event: 'bomber:round_ended', payload: { seq: 2, roundNumber: 1, winner: 1, wins: [0, 1, 0, 0, 0, 0, 0, 0] } }));
    expect(screen.getByText('BIA VENCEU!')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Desligar som' }));
    expect(screen.getByRole('button', { name: 'Ligar som' })).toBeInTheDocument();

    act(() => useBomberStore.getState().applyState({ ...playing(), version: 4, phase: 'FINISHED', wins: [0, 3, 0, 0, 0, 0, 0, 0], result: { winner: 1, wins: [0, 3, 0, 0, 0, 0, 0, 0] } }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Bia é o campeão!')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: /Jogar de novo/ }));
    expect(actions.rematch).toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('button', { name: /Sair/ }));
    expect(actions.leave).toHaveBeenCalled();

    vi.spyOn(window, 'confirm').mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: 'Sair da partida' }));
    expect(actions.leave).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it('shows touch controls on touch screens and feeds the joystick and buttons', async () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as unknown as typeof window.matchMedia;
    render(<BomberRoomScreen code="ABC234" />);
    act(() => useBomberStore.getState().applySnapshot({ state: playing(), mySeat: 0, frame: frame() }));
    act(() => listeners.onFrame(frame({ players: [[0, 1, 1, 2, 0, 0, 3.4, 0, 0, 0, 1, 2, 0, 0]] })));
    const stick = screen.getByLabelText('Joystick');
    fireEvent.pointerDown(stick, { pointerId: 1, clientX: 50, clientY: 50 });
    fireEvent.pointerMove(stick, { pointerId: 1, clientX: 120, clientY: 55 });
    fireEvent.pointerUp(stick, { pointerId: 1 });
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Soltar bomba' }));
    fireEvent.pointerDown(screen.getByRole('button', { name: /Ação/ }));
    expect(await screen.findByText(/Assistindo/)).toBeInTheDocument();
    // @ts-expect-error cleanup of the stub
    delete window.matchMedia;
  });

  it('keeps my user id', () => {
    render(<BomberRoomScreen code="ABC234" />);
    act(() => useBomberStore.getState().applySnapshot({ state: playing(), mySeat: 1, frame: null }));
    expect(useBomberStore.getState().myUserId).toBe(userId(1));
  });
});

import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { frame, roomState, seatPlayer, userId } from '@/test/botao-fixtures';
import { BotaoArt } from './botao-art';
import { BotaoHome } from './botao-home';
import type { BotaoActions, BotaoListeners } from './connection';
import { PublicRooms } from './public-rooms';
import { RoomLobby } from './room-lobby';
import { BotaoRoomScreen } from './room-screen';
import { useBotaoStore } from './store';

const push = vi.fn();
const replace = vi.fn();
const createBotaoRoom = vi.fn();
const sfx = vi.fn();
let publicRooms: unknown = [];
let listeners: BotaoListeners;
let actions: BotaoActions;

vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace }) }));
vi.mock('@/features/profile/profile-pill', () => ({ ProfilePill: () => null }));
vi.mock('@/features/arena/reward-panel', () => ({ MatchRewardPanel: () => <p>prêmio</p> }));
vi.mock('./connection', () => ({
  createBotaoRoom: (isPublic: boolean) => createBotaoRoom(isPublic),
  usePublicBotaoRooms: () => publicRooms,
  useBotaoRoom: (_code: string, l: BotaoListeners) => {
    listeners = l;
    return actions;
  },
}));
vi.mock('./media/audio', () => ({
  unlockAudio: vi.fn(),
  sfx: (name: string) => sfx(name),
  isMuted: () => false,
  toggleMute: () => true,
}));

function fakeActions(): BotaoActions {
  const ok = () => vi.fn().mockResolvedValue(true);
  return { leave: ok(), ready: ok(), setRules: ok(), setVisibility: ok(), setStake: ok(), setTeam: ok(), addBot: ok(), removeBot: ok(), start: ok(), rematch: ok(), input: vi.fn() };
}

beforeEach(() => {
  vi.clearAllMocks();
  publicRooms = [];
  actions = fakeActions();
  useBotaoStore.getState().reset();
});

describe('BotaoHome', () => {
  it('creates a private room and opens it', async () => {
    createBotaoRoom.mockResolvedValue({ ok: true, data: { state: roomState({ code: 'QWE234' }), mySeat: 0, frame: null } });
    render(<BotaoHome />);
    expect(screen.getByRole('heading', { name: 'Futebol de Botão' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: /Privada/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Criar sala' }));
    expect(createBotaoRoom).toHaveBeenCalledWith(false);
    expect(push).toHaveBeenCalledWith('/botao/QWE234');
  });

  it('shows why a room could not be created and joins by code', async () => {
    createBotaoRoom.mockResolvedValue({ ok: false, error: { code: 'INVALID_STATE', message: 'Você já está na sala ABC234' } });
    render(<BotaoHome />);
    await userEvent.click(screen.getByRole('button', { name: 'Criar sala' }));
    expect(screen.getByRole('alert')).toHaveTextContent('ABC234');
    await userEvent.type(screen.getByLabelText('Código da sala'), 'abc');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(screen.getByRole('alert')).toHaveTextContent('6 letras');
    await userEvent.clear(screen.getByLabelText('Código da sala'));
    await userEvent.type(screen.getByLabelText('Código da sala'), 'xyz234');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(push).toHaveBeenCalledWith('/botao/XYZ234');
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
      { code: 'ABC234', hostNickname: 'Ana', hostCharacter: null, stake: 30, players: [2, 1], rules: { minutes: 3, goals: 1 } },
      { code: 'DEF234', hostNickname: 'Bia', hostCharacter: null, stake: 0, players: [1, 0], rules: { minutes: 5, goals: 0 } },
    ];
    rerender(<PublicRooms />);
    expect(screen.getByRole('link', { name: /sala de Ana, 2 contra 1, 3 de 8/ })).toHaveAttribute('href', '/botao/ABC234');
    expect(screen.getByText('1 gol')).toBeInTheDocument();
    expect(screen.getByText('sem limite de gols')).toBeInTheDocument();
  });
});

it('BotaoArt draws a decorative field', () => {
  const { container } = render(<BotaoArt />);
  expect(container.firstElementChild).toHaveAttribute('aria-hidden');
  expect(container.querySelectorAll('circle').length).toBeGreaterThan(4);
});

describe('RoomLobby', () => {
  const cpu = seatPlayer(5, { bot: true, ready: true, userId: 'cpu:1', nickname: 'CPU 1' });
  const lobby = (over = {}) =>
    roomState({
      phase: 'LOBBY',
      lobbyStatus: 'WAITING_PLAYERS',
      seats: [seatPlayer(0, { ready: true }), null, null, null, seatPlayer(4), cpu, null, null],
      ...over,
    });

  it('host sets rules, visibility, CPUs per team and starts', async () => {
    render(<RoomLobby state={lobby({ lobbyStatus: 'READY_TO_START' })} mySeat={0} actions={actions} />);
    const red = screen.getByRole('list', { name: 'Time Vermelho' });
    const blue = screen.getByRole('list', { name: 'Time Azul' });
    expect(within(red).getByText('Ana')).toBeInTheDocument();
    expect(within(blue).getByText('CPU 1')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: "5'" }));
    expect(actions.setRules).toHaveBeenCalledWith({ minutes: 5, goals: 3 });
    await userEvent.click(screen.getByRole('radio', { name: '∞' }));
    expect(actions.setRules).toHaveBeenCalledWith({ minutes: 3, goals: 0 });
    await userEvent.click(screen.getByRole('button', { name: /Pública/ }));
    expect(actions.setVisibility).toHaveBeenCalledWith(false);
    await userEvent.click(within(blue).getByRole('button', { name: /\+ CPU/ }));
    expect(actions.addBot).toHaveBeenCalledWith(1);
    await userEvent.click(screen.getByRole('button', { name: 'Tirar CPU 1' }));
    expect(actions.removeBot).toHaveBeenCalledWith(5);
    await userEvent.click(screen.getByRole('button', { name: /Entrar/ }));
    expect(actions.setTeam).toHaveBeenCalledWith(1);
    await userEvent.click(screen.getByRole('button', { name: /Pronto!/ }));
    expect(actions.ready).toHaveBeenCalledWith(false);
    await userEvent.click(screen.getByRole('button', { name: /Começar/ }));
    expect(actions.start).toHaveBeenCalled();
    expect(screen.getByText(/Toque em Começar/)).toBeInTheDocument();
  });

  it('guests only see their own controls and the waiting hints', async () => {
    render(
      <RoomLobby
        state={lobby({ isPublic: false, seats: [seatPlayer(0), null, null, null, seatPlayer(4, { connected: false, reconnectDeadline: Date.now() + 9000 }), null, null, null] })}
        mySeat={4}
        actions={actions}
      />,
    );
    expect(screen.queryByRole('button', { name: /Começar/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /\+ CPU/ })).not.toBeInTheDocument();
    expect(screen.getAllByText('Lugar livre').length).toBe(2);
    expect(screen.getByText(/confirme que está pronto/)).toBeInTheDocument();
    expect(screen.getByRole('listitem', { name: 'Edu' })).toHaveClass('opacity-60');
    await userEvent.click(screen.getByRole('button', { name: 'Estou pronto' }));
    expect(actions.ready).toHaveBeenCalledWith(true);
    await userEvent.click(screen.getByRole('button', { name: 'Sair da sala' }));
    expect(actions.leave).toHaveBeenCalled();
  });

  it('asks for players on both sides and shares the room link', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const { rerender } = render(<RoomLobby state={lobby({ seats: [seatPlayer(0), null, null, null, null, null, null, null] })} mySeat={0} actions={actions} />);
    expect(screen.getByText(/chame a galera ou a CPU/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Compartilhar sala' }));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('/botao/ABC234'));
    rerender(<RoomLobby state={lobby({ hostId: userId(4), seats: [seatPlayer(0), null, null, null, null, null, null, null] })} mySeat={0} actions={actions} />);
    expect(screen.getByText(/Esperando os dois times/)).toBeInTheDocument();
    rerender(<RoomLobby state={lobby({ hostId: userId(4), lobbyStatus: 'READY_TO_START' })} mySeat={0} actions={actions} />);
    expect(screen.getByText(/Esperando o anfitrião/)).toBeInTheDocument();
  });
});

describe('BotaoRoomScreen', () => {
  const playing = () => roomState();

  it('shows loading, exit screens and leaves to the lobby', () => {
    render(<BotaoRoomScreen code="ABC234" />);
    expect(screen.getByRole('status')).toHaveTextContent('Entrando na sala');
    act(() => useBotaoStore.getState().setConnection('reconnecting'));
    expect(screen.getAllByRole('status')[0]).toHaveTextContent('Reconectando');
    act(() => useBotaoStore.getState().setExit({ reason: 'full', message: 'A sala está cheia' }));
    expect(screen.getByRole('heading', { name: 'Sala cheia' })).toBeInTheDocument();
    act(() => useBotaoStore.getState().setExit({ reason: 'left', message: '' }));
    expect(replace).toHaveBeenCalledWith('/botao');
  });

  it('tells me when I was removed from the room', () => {
    render(<BotaoRoomScreen code="ABC234" />);
    act(() => useBotaoStore.getState().applySnapshot({ state: playing(), mySeat: 0, frame: null }));
    const gone = playing();
    gone.version = 9;
    gone.seats = [null, null, null, null, seatPlayer(4), null, null, null];
    act(() => useBotaoStore.getState().applyState(gone));
    expect(screen.getByRole('heading', { name: 'Não deu para entrar' })).toBeInTheDocument();
  });

  it('shows the lobby, then the field with scoreboard, sounds, banners and results', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
    render(<BotaoRoomScreen code="ABC234" />);
    act(() => useBotaoStore.getState().applySnapshot({ state: roomState({ phase: 'LOBBY', lobbyStatus: 'WAITING_PLAYERS' }), mySeat: 0, frame: null }));
    expect(screen.getByRole('heading', { name: 'Vestiário' })).toBeInTheDocument();

    act(() => useBotaoStore.getState().applyState({ ...playing(), version: 3 }));
    expect(screen.getByRole('timer')).toHaveTextContent('3:00');
    act(() => listeners.onFrame(frame({ phase: 'countdown', phaseLeft: 1 })));
    expect(screen.getByText('PREPARAR…')).toBeInTheDocument();
    act(() => listeners.onFrame(frame({ phase: 'kickoff', events: [{ k: 'whistle' }, { k: 'kick', seat: 0 }, { k: 'kick', seat: 4 }, { k: 'post' }] })));
    expect(screen.getByText('VALENDO!')).toBeInTheDocument();
    expect(sfx.mock.calls.map((c) => c[0])).toEqual(['whistle', 'myKick', 'kick', 'post']);
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.queryByText('VALENDO!')).not.toBeInTheDocument();

    act(() => listeners.onAnnouncement({ event: 'botao:goal', payload: { seq: 1, goal: { team: 1, scorer: 4, own: false, at: 30 }, score: [0, 1] } }));
    expect(screen.getByText('GOOOL!')).toBeInTheDocument();
    expect(screen.getByText('Edu')).toBeInTheDocument();
    expect(sfx).toHaveBeenLastCalledWith('concede');
    act(() => listeners.onAnnouncement({ event: 'botao:goal', payload: { seq: 2, goal: { team: 0, scorer: 4, own: true, at: 40 }, score: [1, 1] } }));
    expect(screen.getByText('Edu (contra)')).toBeInTheDocument();
    expect(sfx).toHaveBeenLastCalledWith('goal');
    act(() => listeners.onFrame(frame({ overtime: true, clock: 5, score: [1, 1], events: [{ k: 'end' }] })));
    expect(screen.getByText('GOL DE OURO!')).toBeInTheDocument();
    expect(sfx).toHaveBeenLastCalledWith('end');

    fireEvent.click(screen.getByRole('button', { name: 'Desligar som' }));
    expect(screen.getByRole('button', { name: 'Ligar som' })).toBeInTheDocument();

    const goals = [
      { team: 0, scorer: 0, own: false, at: 61 },
      { team: 1, scorer: null, own: false, at: 70 },
    ];
    act(() => useBotaoStore.getState().applyState({ ...playing(), version: 4, phase: 'FINISHED', score: [2, 1], result: { winner: 0, score: [2, 1], goals, walkover: false } }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: 'Vitória!' })).toBeInTheDocument();
    expect(within(dialog).getAllByText("2'")).toHaveLength(2);
    expect(within(dialog).getByText('Alguém que saiu')).toBeInTheDocument();
    expect(within(dialog).getByText('prêmio')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: /Jogar de novo/ }));
    expect(actions.rematch).toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('button', { name: /Sair/ }));
    expect(actions.leave).toHaveBeenCalled();

    vi.spyOn(window, 'confirm').mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: 'Sair da partida' }));
    expect(actions.leave).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it('a walkover loss shows the defeat', () => {
    render(<BotaoRoomScreen code="ABC234" />);
    act(() => useBotaoStore.getState().applySnapshot({ state: roomState({ phase: 'FINISHED', result: { winner: 1, score: [0, 0], goals: [], walkover: true } }), mySeat: 0, frame: null }));
    expect(screen.getByRole('heading', { name: 'Derrota' })).toBeInTheDocument();
    expect(screen.getByText(/por W\.O\./)).toBeInTheDocument();
  });

  it('shows touch controls on touch screens and feeds the joystick and kick', () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as unknown as typeof window.matchMedia;
    render(<BotaoRoomScreen code="ABC234" />);
    act(() => useBotaoStore.getState().applySnapshot({ state: playing(), mySeat: 0, frame: frame() }));
    const stick = screen.getByLabelText('Joystick');
    fireEvent.pointerDown(stick, { pointerId: 1, clientX: 50, clientY: 50 });
    fireEvent.pointerMove(stick, { pointerId: 1, clientX: 120, clientY: 55 });
    fireEvent.pointerUp(stick, { pointerId: 1 });
    const kick = screen.getByRole('button', { name: 'Chutar (segure)' });
    fireEvent.pointerDown(kick, { pointerId: 2 });
    expect(kick).toHaveAttribute('aria-pressed', 'true');
    fireEvent.pointerUp(kick, { pointerId: 2 });
    expect(kick).toHaveAttribute('aria-pressed', 'false');
    // @ts-expect-error limpeza do stub
    delete window.matchMedia;
  });

  it('keeps my user id', () => {
    render(<BotaoRoomScreen code="ABC234" />);
    act(() => useBotaoStore.getState().applySnapshot({ state: playing(), mySeat: 4, frame: null }));
    expect(useBotaoStore.getState().myUserId).toBe(userId(4));
  });
});

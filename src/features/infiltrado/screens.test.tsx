import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { frame, me, roomState } from '@/test/infiltrado-fixtures';
import type { InfActions, InfListeners } from './connection';
import { InfiltradoHome } from './infiltrado-home';
import { MeetingOverlay } from './meeting';
import { EjectOverlay, IntroOverlay, ResultsOverlay } from './overlays';
import { PublicRooms } from './public-rooms';
import { nextFreeColor, RoomLobby } from './room-lobby';
import { InfRoomScreen } from './room-screen';
import { useInfStore } from './store';

const push = vi.fn();
const replace = vi.fn();
const createInfRoom = vi.fn();
let publicRooms: unknown = [];
let listeners: InfListeners | undefined;
let actions: InfActions;

vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace }) }));
vi.mock('@/features/profile/profile-pill', () => ({ ProfilePill: () => null }));
vi.mock('@/features/arena/reward-panel', () => ({ MatchRewardPanel: () => null }));
vi.mock('./connection', () => ({
  createInfRoom: (isPublic: boolean) => createInfRoom(isPublic),
  usePublicInfRooms: () => publicRooms,
  useInfRoom: (_code: string, l: InfListeners) => {
    listeners = l;
    return actions;
  },
}));
vi.mock('./media/audio', () => ({ unlockAudio: vi.fn(), sfx: vi.fn(), isMuted: () => false, toggleMute: () => true }));

function fakeActions(): InfActions {
  const ok = () => vi.fn().mockResolvedValue(true);
  return { leave: ok(), ready: ok(), setRules: ok(), setVisibility: ok(), setColor: ok(), addBot: ok(), removeBot: ok(), start: ok(), rematch: ok(), act: ok(), chat: ok(), input: vi.fn() };
}

beforeEach(() => {
  vi.clearAllMocks();
  publicRooms = [];
  listeners = undefined;
  actions = fakeActions();
  useInfStore.getState().reset();
});

describe('InfiltradoHome', () => {
  it('creates a private room and opens it', async () => {
    createInfRoom.mockResolvedValue({ ok: true, data: { state: roomState({ code: 'QWE234' }), mySeat: 0, frame: null, chat: [] } });
    render(<InfiltradoHome />);
    await userEvent.click(screen.getByRole('radio', { name: /Privada/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Criar sala' }));
    expect(createInfRoom).toHaveBeenCalledWith(false);
    expect(push).toHaveBeenCalledWith('/infiltrado/QWE234');
  });

  it('validates the room code', async () => {
    render(<InfiltradoHome />);
    await userEvent.type(screen.getByLabelText('Código da sala'), 'ab');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(screen.getByRole('alert')).toHaveTextContent('6 letras');
  });
});

describe('PublicRooms', () => {
  it('lists the open rooms', () => {
    publicRooms = [{ code: 'AAA111', hostNickname: 'Ana', hostCharacter: null, players: 7, rules: roomState().rules }];
    render(<PublicRooms />);
    expect(screen.getByRole('link', { name: /Ana, 7 de 15/ })).toHaveAttribute('href', '/infiltrado/AAA111');
  });
});

describe('RoomLobby', () => {
  it('shows 15 seats; the host adds CPUs, edits rules and starts', async () => {
    const state = roomState({ lobbyStatus: 'READY_TO_START' });
    render(<RoomLobby state={state} mySeat={0} actions={actions} />);
    expect(screen.getByRole('list', { name: /Jogadores/ }).children).toHaveLength(15);
    await userEvent.click(screen.getAllByRole('button', { name: /\+ CPU/ })[0]);
    expect(actions.addBot).toHaveBeenCalled();
    await userEvent.click(screen.getAllByRole('radio', { name: '2' })[0]);
    expect(actions.setRules).toHaveBeenCalledWith(expect.objectContaining({ impostors: 2 }));
    await userEvent.click(screen.getByRole('button', { name: /INICIAR/ }));
    expect(actions.start).toHaveBeenCalled();
  });

  it('guests cannot change the rules', () => {
    render(<RoomLobby state={roomState()} mySeat={1} actions={actions} />);
    expect(screen.queryByRole('button', { name: /INICIAR/ })).toBeNull();
    expect(screen.getAllByRole('radio', { name: '2' })[0]).toBeDisabled();
  });

  it('nextFreeColor skips colors already taken', () => {
    const state = roomState();
    expect(nextFreeColor(state, 0, 1)).toBe(4);
    expect(nextFreeColor(state, 0, -1)).toBe(14);
  });
});

describe('overlays', () => {
  it('intro tells infiltrators who their partners are', () => {
    render(<IntroOverlay state={roomState({ phase: 'PLAYING' })} mySeat={0} frame={frame({ phase: 'intro', me: me({ role: 'impostor', mates: [2] }) })} />);
    expect(screen.getByRole('heading')).toHaveTextContent('INFILTRADO');
    expect(screen.getByRole('list', { name: 'Seu time' }).children).toHaveLength(2);
  });

  it('ejection reveals the role when the room allows it', () => {
    render(<EjectOverlay state={roomState()} frame={frame({ phase: 'eject', eject: { seat: 1, tie: false, wasImpostor: false, impostorsLeft: 1 } })} />);
    expect(screen.getByText('P1 não era um Infiltrado.')).toBeInTheDocument();
    expect(screen.getByText('1 infiltrado restante')).toBeInTheDocument();
  });

  it('results show the winner and every role', async () => {
    const state = roomState({ phase: 'FINISHED', result: { winner: 'impostor', reason: 'kills', impostors: [2] } });
    render(<ResultsOverlay state={state} mySeat={2} actions={actions} />);
    expect(screen.getByRole('heading')).toHaveTextContent('VITÓRIA');
    expect(screen.getAllByText('INFILTRADO')).toHaveLength(1);
    await userEvent.click(screen.getByRole('button', { name: /Jogar de novo/ }));
    expect(actions.rematch).toHaveBeenCalled();
  });
});

describe('MeetingOverlay', () => {
  const meeting = { caller: 1, body: 3, stage: 'vote' as const, left: 40, voters: [0, 1, 2], voted: [1], votes: null };

  it('votes for a suspect with a confirmation', async () => {
    render(<MeetingOverlay state={roomState({ phase: 'PLAYING' })} mySeat={0} frame={frame({ phase: 'meeting', meeting })} actions={actions} />);
    expect(screen.getByText('P1 encontrou P3')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'P2' }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar voto em P2' }));
    expect(actions.act).toHaveBeenCalledWith({ t: 'vote', target: 2 });
  });

  it('ghosts cannot vote but can chat', async () => {
    render(<MeetingOverlay state={roomState({ phase: 'PLAYING' })} mySeat={3} frame={frame({ phase: 'meeting', meeting, me: me({ alive: false }) })} actions={actions} />);
    expect(screen.getByRole('button', { name: /PULAR VOTO/ })).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Mensagem'), 'fui eu não{enter}');
    expect(actions.chat).toHaveBeenCalledWith('fui eu não');
  });
});

describe('InfRoomScreen', () => {
  it('joins and shows the lobby once the snapshot arrives', () => {
    render(<InfRoomScreen code="ABC123" />);
    expect(screen.getByRole('status')).toHaveTextContent('Entrando');
    act(() => useInfStore.getState().applySnapshot({ state: roomState(), mySeat: 0, frame: null, chat: [] }));
    expect(screen.getByRole('heading', { name: 'INFILTRADO' })).toBeInTheDocument();
    expect(listeners).toBeDefined();
  });
});

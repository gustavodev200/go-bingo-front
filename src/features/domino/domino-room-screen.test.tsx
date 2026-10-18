import { act, render, screen } from '@testing-library/react';
import { privateHand, roomState } from '@/test/domino-fixtures';
import type { DominoListeners } from './connection';
import { DominoRoomScreen } from './domino-room-screen';
import { useDominoStore } from './store';

const replace = vi.fn();
const speak = vi.fn();
const play = vi.fn();
let listeners: DominoListeners;
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));
vi.mock('./connection', () => ({
  useDominoRoom: (_code: string, l: DominoListeners) => {
    listeners = l;
    return {};
  },
}));
vi.mock('@/features/voice/voice-chat', () => ({ VoiceChat: () => null }));
vi.mock('@/features/game/sound/narration', () => ({ sharedNarrator: () => ({ supported: true, speak }) }));
vi.mock('@/features/game/sound/sfx-player', () => ({ sharedSfxPlayer: () => ({ play, unlock: vi.fn(), isRunning: () => true }) }));

describe('DominoRoomScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    useDominoStore.getState().reset();
  });

  it('shows a loading state, then the exit screen for a missing table', () => {
    render(<DominoRoomScreen code="ABC234" />);
    expect(screen.getByRole('status')).toHaveTextContent('Entrando na mesa');
    act(() => useDominoStore.getState().setExit({ reason: 'not_found', message: 'Mesa não encontrada' }));
    expect(screen.getByRole('heading', { name: 'Mesa não encontrada' })).toBeInTheDocument();
  });

  it('goes back to the lobby after leaving', () => {
    render(<DominoRoomScreen code="ABC234" />);
    act(() => useDominoStore.getState().setExit({ reason: 'left', message: '' }));
    expect(replace).toHaveBeenCalledWith('/domino');
  });

  it('renders the waiting room in the lobby and the table during the match', () => {
    render(<DominoRoomScreen code="ABC234" />);
    act(() => useDominoStore.getState().applySnapshot({ state: roomState({ phase: 'LOBBY', lobbyStatus: 'WAITING_PLAYERS', round: null }), mySeat: 0, hand: null }));
    expect(screen.getByRole('button', { name: 'Estou pronto!' })).toBeInTheDocument();
    act(() => useDominoStore.getState().applySnapshot({ state: roomState({ version: 2 }), mySeat: 0, hand: privateHand() }));
    expect(screen.getByRole('list', { name: 'Suas peças' })).toBeInTheDocument();
  });

  it('turns an announcement into a shout, a sound and a voice line', () => {
    render(<DominoRoomScreen code="ABC234" />);
    act(() => useDominoStore.getState().applySnapshot({ state: roomState(), mySeat: 0, hand: privateHand() }));
    act(() => listeners.onAnnouncement({ event: 'domino:round_ended', payload: { seq: 1, winners: [0], points: 20, blocked: false, pips: [0, 10, 10, 0], scores: [20, 0, 0, 0] } }));
    expect(screen.getAllByText('BATEU! +20').length).toBeGreaterThan(0);
    expect(play).toHaveBeenCalledWith('hand-won');
    expect(speak).toHaveBeenCalledWith('Bati!');
  });

  it('shows emotes over the player who sent them', () => {
    render(<DominoRoomScreen code="ABC234" />);
    act(() => useDominoStore.getState().applySnapshot({ state: roomState(), mySeat: 0, hand: privateHand() }));
    act(() => listeners.onEmote({ seat: 1, emote: 'fire' }));
    expect(screen.getByLabelText('Bia: Pegando fogo')).toBeInTheDocument();
  });
});

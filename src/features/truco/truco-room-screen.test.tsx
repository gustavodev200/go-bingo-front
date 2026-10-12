import { act, render, screen } from '@testing-library/react';
import { privateHand, roomState } from '@/test/truco-fixtures';
import type { TrucoListeners } from './connection';
import { useTrucoStore } from './store';
import { TrucoRoomScreen } from './truco-room-screen';

const replace = vi.fn();
const speak = vi.fn();
const play = vi.fn();
let listeners: TrucoListeners;
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));
vi.mock('./connection', () => ({
  useTrucoRoom: (_code: string, l: TrucoListeners) => {
    listeners = l;
    return {};
  },
}));
vi.mock('@/features/game/sound/narration', () => ({ sharedNarrator: () => ({ supported: true, speak }) }));
vi.mock('@/features/game/sound/sfx-player', () => ({ sharedSfxPlayer: () => ({ play, unlock: vi.fn(), isRunning: () => true }) }));

describe('TrucoRoomScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    useTrucoStore.getState().reset();
  });

  it('shows a loading state until the snapshot arrives', () => {
    render(<TrucoRoomScreen code="ABC234" />);
    expect(screen.getByRole('status')).toHaveTextContent('Entrando na mesa');
  });

  it('shows the exit screen for a missing table and goes back after leaving', () => {
    render(<TrucoRoomScreen code="ABC234" />);
    act(() => useTrucoStore.getState().setExit({ reason: 'not_found', message: 'Mesa não encontrada' }));
    expect(screen.getByRole('heading', { name: 'Mesa não encontrada' })).toBeInTheDocument();
    act(() => useTrucoStore.getState().setExit({ reason: 'left', message: '' }));
    expect(replace).toHaveBeenCalledWith('/truco');
  });

  it('renders the waiting room in the lobby and the table during the match', () => {
    render(<TrucoRoomScreen code="ABC234" />);
    act(() => useTrucoStore.getState().applySnapshot({ state: roomState({ phase: 'LOBBY', lobbyStatus: 'WAITING_PLAYERS', match: null }), mySeat: 0, hand: null }));
    expect(screen.getByRole('button', { name: 'Estou pronto!' })).toBeInTheDocument();
    act(() => useTrucoStore.getState().applySnapshot({ state: roomState({ version: 2 }), mySeat: 0, hand: privateHand() }));
    expect(screen.getByRole('list', { name: 'Suas cartas' })).toBeInTheDocument();
  });

  it('turns a validated announcement into a shout, a sound and a voice line', () => {
    render(<TrucoRoomScreen code="ABC234" />);
    act(() => useTrucoStore.getState().applySnapshot({ state: roomState(), mySeat: 0, hand: privateHand() }));
    act(() => listeners.onAnnouncement({ event: 'truco:bet_requested', payload: { seq: 1, seat: 1, team: 1, value: 4 } }));
    expect(screen.getByText('TRUCO!')).toBeInTheDocument();
    expect(play).toHaveBeenCalledWith('truco');
    expect(speak).toHaveBeenCalledWith('TRUUUCO! Corre ou aceita!');
  });

  it('keeps the voice silent when it is switched off', () => {
    localStorage.setItem('truco:voice', '0');
    render(<TrucoRoomScreen code="ABC234" />);
    act(() => useTrucoStore.getState().applySnapshot({ state: roomState(), mySeat: 0, hand: privateHand() }));
    act(() => listeners.onAnnouncement({ event: 'truco:bet_requested', payload: { seq: 1, seat: 1, team: 1, value: 4 } }));
    expect(play).toHaveBeenCalledWith('truco');
    expect(speak).not.toHaveBeenCalled();
  });

  it('animates partner signals with their meaning and opponents without it', () => {
    render(<TrucoRoomScreen code="ABC234" />);
    act(() => useTrucoStore.getState().applySnapshot({ state: roomState(), mySeat: 0, hand: privateHand() }));
    act(() => {
      listeners.onSignal({ fromSeat: 2, gesture: 'wink' });
      listeners.onGesture({ seat: 3 });
      listeners.onError();
    });
    expect(screen.getByText(/Zap \(4 de paus\)/)).toBeInTheDocument();
    expect(screen.getByLabelText('fez um gesto')).toBeInTheDocument();
    expect(play).toHaveBeenCalledWith('signal');
    expect(play).toHaveBeenCalledWith('error');
  });
});

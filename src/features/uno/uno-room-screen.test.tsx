import { act, render, screen } from '@testing-library/react';
import { privateHand, roomState } from '@/test/uno-fixtures';
import type { UnoListeners } from './connection';
import { useUnoStore } from './store';
import { UnoRoomScreen } from './uno-room-screen';

const replace = vi.fn();
const speak = vi.fn();
const play = vi.fn();
let listeners: UnoListeners;
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));
vi.mock('./connection', () => ({
  useUnoRoom: (_code: string, l: UnoListeners) => {
    listeners = l;
    return {};
  },
}));
vi.mock('@/features/game/sound/narration', () => ({ sharedNarrator: () => ({ supported: true, speak }) }));
vi.mock('@/features/game/sound/sfx-player', () => ({ sharedSfxPlayer: () => ({ play, unlock: vi.fn(), isRunning: () => true }) }));

describe('UnoRoomScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    useUnoStore.getState().reset();
  });

  it('shows a loading state until the snapshot arrives', () => {
    render(<UnoRoomScreen code="ABC234" />);
    expect(screen.getByRole('status')).toHaveTextContent('Entrando na mesa');
  });

  it('shows the exit screen for a missing table and goes back after leaving', () => {
    render(<UnoRoomScreen code="ABC234" />);
    act(() => useUnoStore.getState().setExit({ reason: 'not_found', message: 'Mesa não encontrada' }));
    expect(screen.getByRole('heading', { name: 'Mesa não encontrada' })).toBeInTheDocument();
    act(() => useUnoStore.getState().setExit({ reason: 'left', message: '' }));
    expect(replace).toHaveBeenCalledWith('/uno');
  });

  it('renders the waiting room in the lobby and the table during the match', () => {
    render(<UnoRoomScreen code="ABC234" />);
    act(() => useUnoStore.getState().applySnapshot({ state: roomState({ phase: 'LOBBY', lobbyStatus: 'WAITING_PLAYERS', round: null }), mySeat: 0, hand: null }));
    expect(screen.getByRole('button', { name: 'Estou pronto!' })).toBeInTheDocument();
    act(() => useUnoStore.getState().applySnapshot({ state: roomState({ version: 2 }), mySeat: 0, hand: privateHand() }));
    expect(screen.getByRole('list', { name: 'Suas cartas' })).toBeInTheDocument();
  });

  it('turns an announcement into a shout, a sound and a voice line', () => {
    render(<UnoRoomScreen code="ABC234" />);
    act(() => useUnoStore.getState().applySnapshot({ state: roomState(), mySeat: 0, hand: privateHand() }));
    act(() => listeners.onAnnouncement({ event: 'uno:uno_called', payload: { seq: 1, seat: 1 } }));
    expect(screen.getAllByText('UNO!').length).toBeGreaterThan(0);
    expect(play).toHaveBeenCalledWith('uno-call');
    expect(speak).toHaveBeenCalledWith('UNO!');
  });

  it('keeps the voice silent when it is switched off', () => {
    localStorage.setItem('uno:voice', '0');
    render(<UnoRoomScreen code="ABC234" />);
    act(() => useUnoStore.getState().applySnapshot({ state: roomState(), mySeat: 0, hand: privateHand() }));
    act(() => listeners.onAnnouncement({ event: 'uno:uno_called', payload: { seq: 1, seat: 1 } }));
    expect(play).toHaveBeenCalledWith('uno-call');
    expect(speak).not.toHaveBeenCalled();
  });

  it('shows emotes over the player who sent them', () => {
    render(<UnoRoomScreen code="ABC234" />);
    act(() => useUnoStore.getState().applySnapshot({ state: roomState(), mySeat: 0, hand: privateHand() }));
    act(() => listeners.onEmote({ seat: 1, emote: 'fire' }));
    expect(screen.getByLabelText('Bia: Pegando fogo')).toBeInTheDocument();
  });
});

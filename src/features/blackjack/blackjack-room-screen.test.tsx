import { act, render, screen } from '@testing-library/react';
import { roomState } from '@/test/blackjack-fixtures';
import type { BjListeners } from './connection';
import { BjRoomScreen } from './blackjack-room-screen';
import { useBjStore } from './store';

const replace = vi.fn();
const speak = vi.fn();
const play = vi.fn();
let listeners: BjListeners;
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));
vi.mock('./connection', () => ({
  useBjRoom: (_code: string, l: BjListeners) => {
    listeners = l;
    return {};
  },
}));
vi.mock('@/features/voice/voice-chat', () => ({ VoiceChat: () => null }));
vi.mock('@/features/game/sound/narration', () => ({ sharedNarrator: () => ({ supported: true, speak }) }));
vi.mock('@/features/game/sound/sfx-player', () => ({ sharedSfxPlayer: () => ({ play, unlock: vi.fn(), isRunning: () => true }) }));

describe('BjRoomScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    useBjStore.getState().reset();
  });

  it('shows a loading state, then the exit screen for a missing table', () => {
    render(<BjRoomScreen code="ABC234" />);
    expect(screen.getByRole('status')).toHaveTextContent('Entrando na mesa');
    act(() => useBjStore.getState().setExit({ reason: 'not_found', message: 'Mesa não encontrada' }));
    expect(screen.getByRole('heading', { name: 'Mesa não encontrada' })).toBeInTheDocument();
  });

  it('goes back to the lobby after leaving', () => {
    render(<BjRoomScreen code="ABC234" />);
    act(() => useBjStore.getState().setExit({ reason: 'left', message: '' }));
    expect(replace).toHaveBeenCalledWith('/blackjack');
  });

  it('renders the waiting room in the lobby and the board during the match', () => {
    render(<BjRoomScreen code="ABC234" />);
    act(() => useBjStore.getState().applySnapshot({ state: roomState({ phase: 'LOBBY', lobbyStatus: 'WAITING_PLAYERS', game: null }), mySeat: 0 }));
    expect(screen.getByRole('button', { name: 'Estou pronto!' })).toBeInTheDocument();
    act(() => useBjStore.getState().applySnapshot({ state: roomState({ version: 2 }), mySeat: 0 }));
    expect(screen.getByRole('group', { name: /Dealer/ })).toBeInTheDocument();
  });

  it('turns a dealer bust into a shout, a sound and a voice line', () => {
    render(<BjRoomScreen code="ABC234" />);
    act(() => useBjStore.getState().applySnapshot({ state: roomState(), mySeat: 0 }));
    act(() => listeners.onAnnouncement({ event: 'blackjack:dealer_played', payload: { seq: 1, total: 24, blackjack: false, bust: true, drew: 1 } }));
    expect(screen.getAllByText('DEALER ESTOUROU!').length).toBeGreaterThan(0);
    expect(play).toHaveBeenCalledWith('hand-won');
    expect(speak).toHaveBeenCalledWith('O dealer estourou!');
  });
});

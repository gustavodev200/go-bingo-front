import { act, render, screen } from '@testing-library/react';
import { roomState } from '@/test/damas-fixtures';
import type { DamasListeners } from './connection';
import { DamasRoomScreen } from './damas-room-screen';
import { useDamasStore } from './store';

const replace = vi.fn();
const speak = vi.fn();
const play = vi.fn();
let listeners: DamasListeners;
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));
vi.mock('./connection', () => ({
  useDamasRoom: (_code: string, l: DamasListeners) => {
    listeners = l;
    return {};
  },
}));
vi.mock('@/features/voice/voice-chat', () => ({ VoiceChat: () => null }));
vi.mock('@/features/game/sound/narration', () => ({ sharedNarrator: () => ({ supported: true, speak }) }));
vi.mock('@/features/game/sound/sfx-player', () => ({ sharedSfxPlayer: () => ({ play, unlock: vi.fn(), isRunning: () => true }) }));

describe('DamasRoomScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    useDamasStore.getState().reset();
  });

  it('shows a loading state, then the exit screen for a missing table', () => {
    render(<DamasRoomScreen code="ABC234" />);
    expect(screen.getByRole('status')).toHaveTextContent('Entrando na mesa');
    act(() => useDamasStore.getState().setExit({ reason: 'not_found', message: 'Mesa não encontrada' }));
    expect(screen.getByRole('heading', { name: 'Mesa não encontrada' })).toBeInTheDocument();
  });

  it('goes back to the lobby after leaving', () => {
    render(<DamasRoomScreen code="ABC234" />);
    act(() => useDamasStore.getState().setExit({ reason: 'left', message: '' }));
    expect(replace).toHaveBeenCalledWith('/damas');
  });

  it('renders the waiting room in the lobby and the board during the match', () => {
    render(<DamasRoomScreen code="ABC234" />);
    act(() => useDamasStore.getState().applySnapshot({ state: roomState({ phase: 'LOBBY', lobbyStatus: 'WAITING_PLAYERS', game: null }), mySeat: 0 }));
    expect(screen.getByRole('button', { name: 'Estou pronto!' })).toBeInTheDocument();
    act(() => useDamasStore.getState().applySnapshot({ state: roomState({ version: 2 }), mySeat: 0 }));
    expect(screen.getByRole('grid', { name: 'Tabuleiro' })).toBeInTheDocument();
  });

  it('turns a promotion into a shout, a sound and a voice line', () => {
    render(<DamasRoomScreen code="ABC234" />);
    act(() => useDamasStore.getState().applySnapshot({ state: roomState(), mySeat: 0 }));
    act(() => listeners.onAnnouncement({ event: 'damas:moved', payload: { seq: 1, seat: 0, from: 9, path: [0], captures: [], promoted: true } }));
    expect(screen.getAllByText('DAMA!').length).toBeGreaterThan(0);
    expect(play).toHaveBeenCalledWith('hand-won');
    expect(speak).toHaveBeenCalledWith('Virou dama!');
  });
});

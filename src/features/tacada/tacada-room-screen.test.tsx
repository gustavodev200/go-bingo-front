import { act, render, screen } from '@testing-library/react';
import { roomState } from '@/test/tacada-fixtures';
import type { TacadaListeners } from './connection';
import { TacadaRoomScreen } from './tacada-room-screen';
import { useTacadaStore } from './store';

const replace = vi.fn();
const speak = vi.fn();
const play = vi.fn();
let listeners: TacadaListeners;
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));
vi.mock('./connection', () => ({
  useTacadaRoom: (_code: string, l: TacadaListeners) => {
    listeners = l;
    return {};
  },
}));
vi.mock('@/features/voice/voice-chat', () => ({ VoiceChat: () => null }));
vi.mock('./pool-table', () => ({ PoolTable: () => <div role="img" aria-label="Mesa de bilhar" /> }));
vi.mock('@/features/game/sound/narration', () => ({ sharedNarrator: () => ({ supported: true, speak }) }));
vi.mock('@/features/game/sound/sfx-player', () => ({ sharedSfxPlayer: () => ({ play, unlock: vi.fn(), isRunning: () => true }) }));

describe('TacadaRoomScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    useTacadaStore.getState().reset();
  });

  it('shows a loading state, then the exit screen for a missing table', () => {
    render(<TacadaRoomScreen code="ABC234" />);
    expect(screen.getByRole('status')).toHaveTextContent('Entrando na mesa');
    act(() => useTacadaStore.getState().setExit({ reason: 'not_found', message: 'Mesa não encontrada' }));
    expect(screen.getByRole('heading', { name: 'Mesa não encontrada' })).toBeInTheDocument();
  });

  it('goes back to the lobby after leaving', () => {
    render(<TacadaRoomScreen code="ABC234" />);
    act(() => useTacadaStore.getState().setExit({ reason: 'left', message: '' }));
    expect(replace).toHaveBeenCalledWith('/tacada');
  });

  it('renders the waiting room in the lobby and the board during the match', () => {
    render(<TacadaRoomScreen code="ABC234" />);
    act(() => useTacadaStore.getState().applySnapshot({ state: roomState({ phase: 'LOBBY', lobbyStatus: 'WAITING_PLAYERS', game: null }), mySeat: 0 }));
    expect(screen.getByRole('button', { name: 'Estou pronto!' })).toBeInTheDocument();
    act(() => useTacadaStore.getState().applySnapshot({ state: roomState({ version: 2 }), mySeat: 0 }));
    expect(screen.getByRole('img', { name: 'Mesa de bilhar' })).toBeInTheDocument();
  });

  it('holds the reactions while a shot rolls, then plays them', () => {
    render(<TacadaRoomScreen code="ABC234" />);
    act(() => useTacadaStore.getState().applySnapshot({ state: roomState(), mySeat: 0 }));
    act(() => useTacadaStore.getState().setAnimating(true));
    act(() => listeners.onAnnouncement({ event: 'tacada:match_over', payload: { seq: 1, winner: 0, reason: 'eight' } }));
    expect(screen.queryByText('VITÓRIA!')).not.toBeInTheDocument();
    act(() => useTacadaStore.getState().setAnimating(false));
    expect(screen.getAllByText('VITÓRIA!').length).toBeGreaterThan(0);
    expect(play).toHaveBeenCalledWith('match-won');
    expect(speak).toHaveBeenCalledWith('Ganhei!');
  });
});

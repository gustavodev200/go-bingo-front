import { act, renderHook } from '@testing-library/react';
import type { RoomSnapshot } from '@/contracts';
import { initialGameState, reduce, useGameStore } from '../store';
import { useGameSounds } from './use-game-sounds';

const ME = '00000000-0000-4000-8000-000000000001';
const ANA = '00000000-0000-4000-8000-000000000002';
const GRID = Array.from({ length: 25 }, () => 0);
const member = (userId: string, slot: number) => ({ userId, nickname: userId === ME ? 'Eu' : 'Ana', slot, isGuest: false, connected: true, hasCard: true });
const inGame = (drawn: number[], remaining: Record<string, number> = { [ME]: 10, [ANA]: 10 }): RoomSnapshot => ({
  code: 'ABC234',
  name: 'Sala',
  hostId: ME,
  maxPlayers: 10,
  isPublic: true,
  winPattern: 'FULL_CARD',
  status: 'IN_GAME',
  members: [member(ME, 0), member(ANA, 1)],
  myCard: null,
  game: { id: '00000000-0000-4000-8000-0000000000bb', drawn, drawIntervalMs: 5000, remaining },
});
const drawnEvent = (number: number) => ({ event: 'game:number_drawn' as const, payload: { seq: 4, number, letter: 'N' as const, drawnAt: new Date(0).toISOString() } });

describe('useGameSounds', () => {
  const player = { unlock: vi.fn(), play: vi.fn(), isRunning: vi.fn(() => false) };
  beforeEach(() => {
    vi.clearAllMocks();
    useGameStore.setState(reduce(initialGameState(ME), { event: 'room:state', payload: inGame([1, 2, 3]) }));
  });

  it('is silent on the first snapshot, then plays each new number', () => {
    renderHook(() => useGameSounds(false, player));
    expect(player.play).not.toHaveBeenCalled();
    act(() => useGameStore.getState().dispatch(drawnEvent(40)));
    expect(player.play).toHaveBeenCalledWith('draw');
  });

  it('plays the one-away chime and my fanfare', () => {
    renderHook(() => useGameSounds(false, player));
    act(() => useGameStore.getState().dispatch({ event: 'game:progress', payload: { remaining: { [ME]: 1, [ANA]: 10 } } }));
    expect(player.play).toHaveBeenCalledWith('one-away');
    act(() => useGameStore.getState().dispatch({ event: 'game:won', payload: { userId: ME, nickname: 'Eu', pointsAwarded: 20, coinsAwarded: 100, grid: GRID } }));
    expect(player.play).toHaveBeenCalledWith('bingo-me');
  });

  it('stays quiet when muted', () => {
    renderHook(() => useGameSounds(true, player));
    act(() => useGameStore.getState().dispatch(drawnEvent(40)));
    expect(player.play).not.toHaveBeenCalled();
  });

  it('unlocks audio on real user gestures (tap, click, key) until the context is running', () => {
    const { unmount } = renderHook(() => useGameSounds(false, player));
    window.dispatchEvent(new Event('touchend'));
    window.dispatchEvent(new Event('keydown'));
    expect(player.unlock).toHaveBeenCalledTimes(2);
    player.isRunning.mockReturnValue(true);
    window.dispatchEvent(new Event('click'));
    window.dispatchEvent(new Event('click'));
    expect(player.unlock).toHaveBeenCalledTimes(3);
    unmount();
  });

  it('a reconnect resync is silent, then normal draws play again', () => {
    renderHook(() => useGameSounds(false, player));
    act(() => useGameStore.getState().setConnection('reconnecting'));
    act(() => useGameStore.getState().dispatch({ event: 'room:state', payload: inGame([1, 2, 3, 4, 5, 6], { [ME]: 1, [ANA]: 10 }) }));
    act(() => useGameStore.getState().setConnection('online'));
    expect(player.play).not.toHaveBeenCalled();
    act(() => useGameStore.getState().dispatch(drawnEvent(40)));
    expect(player.play).toHaveBeenCalledWith('draw');
  });
});

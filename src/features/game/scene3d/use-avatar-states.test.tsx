import { act, renderHook } from '@testing-library/react';
import type { RoomSnapshot } from '@/contracts';
import { initialGameState, reduce, useGameStore } from '../store';
import { BOT_ID_PREFIX } from './bots';
import { useAvatarStates } from './use-avatar-states';

const ME = '00000000-0000-4000-8000-000000000001';
const ANA = '00000000-0000-4000-8000-000000000002';
const member = (userId: string, slot: number) => ({ userId, nickname: userId === ME ? 'Eu' : 'Ana', slot, isGuest: false, connected: true, hasCard: false });

function room(members = [member(ME, 0)]): RoomSnapshot {
  return { code: 'ABC234', name: 'Sala', hostId: ME, maxPlayers: 25, isPublic: true, status: 'WAITING', members, myCard: null, game: null };
}

let now = 0;
const clock = () => now;

describe('useAvatarStates', () => {
  beforeEach(() => {
    now = 0;
    vi.useFakeTimers();
    useGameStore.setState(reduce(initialGameState(ME), { event: 'room:state', payload: room() }));
  });
  afterEach(() => vi.useRealTimers());

  it('starts from the current snapshot with everyone idle', () => {
    const { result } = renderHook(() => useAvatarStates(0, clock));
    expect(result.current.list.map((s) => [s.userId, s.phase])).toEqual([[ME, 'idle']]);
    expect(result.current.statesRef.current.get(ME)?.isHost).toBe(true);
  });

  it('reacts to store events without re-rendering every frame', () => {
    const { result } = renderHook(() => useAvatarStates(0, clock));
    now = 1000;
    act(() => useGameStore.getState().dispatch({ event: 'room:member_joined', payload: { member: member(ANA, 1), reconnected: false } }));
    expect(result.current.list.find((s) => s.userId === ANA)?.phase).toBe('entering');
    const before = result.current.list;
    now = 1100;
    act(() => vi.advanceTimersByTime(150)); // tick sem mudança de fase
    expect(result.current.list).toBe(before);
  });

  it('expires animations on its own tick', () => {
    const { result } = renderHook(() => useAvatarStates(0, clock));
    act(() => useGameStore.getState().dispatch({ event: 'room:member_joined', payload: { member: member(ANA, 1), reconnected: false } }));
    now = 5000;
    act(() => vi.advanceTimersByTime(150));
    expect(result.current.statesRef.current.get(ANA)?.phase).toBe('idle');
  });

  it('dance works only on my own avatar', () => {
    useGameStore.setState(reduce(initialGameState(ME), { event: 'room:state', payload: room([member(ME, 0), member(ANA, 1)]) }));
    const { result } = renderHook(() => useAvatarStates(0, clock));
    act(() => result.current.dance(ANA));
    expect(result.current.statesRef.current.get(ANA)?.phase).toBe('idle');
    act(() => result.current.dance(ME));
    expect(result.current.statesRef.current.get(ME)?.phase).toBe('dance');
  });

  it('adds load-test bots one per tick until the requested total', () => {
    const { result } = renderHook(() => useAvatarStates(4, clock));
    act(() => vi.advanceTimersByTime(150 * 5));
    const bots = result.current.list.filter((s) => s.userId.startsWith(BOT_ID_PREFIX));
    expect(bots).toHaveLength(3);
    expect(useGameStore.getState().snapshot?.members).toHaveLength(1); // bots nunca entram na store
  });

  it('stops listening on unmount', () => {
    const { result, unmount } = renderHook(() => useAvatarStates(0, clock));
    const ref = result.current.statesRef;
    unmount();
    act(() => useGameStore.getState().dispatch({ event: 'room:member_joined', payload: { member: member(ANA, 1), reconnected: false } }));
    expect(ref.current.has(ANA)).toBe(false);
  });

  it('waits for the snapshot before choreographing', () => {
    useGameStore.setState(initialGameState(ME));
    const { result } = renderHook(() => useAvatarStates(0, clock));
    expect(result.current.list).toEqual([]);
    act(() => useGameStore.getState().dispatch({ event: 'room:state', payload: room() }));
    expect(result.current.list.map((s) => s.phase)).toEqual(['idle']);
  });
});

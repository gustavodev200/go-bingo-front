import type { RoomSnapshot } from '@/contracts';
import { initialGameState, reduce, useGameStore } from './store';

const ME = '00000000-0000-4000-8000-000000000001';
const grid = Array.from({ length: 25 }, (_, i) => (i === 12 ? 0 : i + 1));
const card = { id: '00000000-0000-4000-8000-0000000000aa', grid, marked: [] };
const waiting: RoomSnapshot = {
  code: 'ABC234', name: 'Sala', hostId: ME, maxPlayers: 10, isPublic: true, status: 'WAITING',
  members: [{ userId: ME, nickname: 'Eu', slot: 0, isGuest: false, connected: true, hasCard: false }],
  myCard: null, game: null,
};

describe('useGameStore actions', () => {
  beforeEach(() => useGameStore.getState().reset(ME));

  it('reset starts a fresh session for the user', () => {
    useGameStore.getState().dispatch({ event: 'room:state', payload: waiting });
    useGameStore.getState().reset(ME);
    expect(useGameStore.getState()).toMatchObject(initialGameState(ME));
  });

  it('setMyCard stores the card and marks me ready; no-op before the snapshot', () => {
    useGameStore.getState().setMyCard(card);
    expect(useGameStore.getState().snapshot).toBeNull();
    useGameStore.getState().dispatch({ event: 'room:state', payload: waiting });
    useGameStore.getState().setMyCard(card);
    expect(useGameStore.getState().snapshot?.myCard).toEqual(card);
    expect(useGameStore.getState().snapshot?.members[0].hasCard).toBe(true);
  });

  it('setMarked replaces marks only when I have a card', () => {
    useGameStore.getState().dispatch({ event: 'room:state', payload: waiting });
    useGameStore.getState().setMarked([1]);
    expect(useGameStore.getState().snapshot?.myCard).toBeNull();
    useGameStore.getState().setMyCard(card);
    useGameStore.getState().setMarked([1, 2]);
    expect(useGameStore.getState().snapshot?.myCard?.marked).toEqual([1, 2]);
  });

  it('setConnection and setExit', () => {
    useGameStore.getState().setConnection('online');
    useGameStore.getState().setExit({ reason: 'kicked' });
    expect(useGameStore.getState()).toMatchObject({ connection: 'online', exit: { reason: 'kicked' } });
  });
});

describe('reduce edge cases', () => {
  const lobby = () => reduce(initialGameState(ME), { event: 'room:state', payload: waiting });

  it('ignores game events while there is no game', () => {
    const s = lobby();
    expect(reduce(s, { event: 'game:number_drawn', payload: { seq: 1, number: 7, letter: 'B', drawnAt: '' } })).toBe(s);
    expect(reduce(s, { event: 'game:progress', payload: { remaining: {} } })).toBe(s);
    expect(reduce(s, { event: 'game:started', payload: { gameId: 'g', drawIntervalMs: 5000 } })).toBe(s);
  });

  it('game:ended without winner goes back to waiting', () => {
    const s = reduce({ ...lobby(), snapshot: { ...waiting, status: 'IN_GAME' } }, { event: 'game:ended', payload: { reason: 'exhausted' } });
    expect(s.endedWithoutWinner).toBe(true);
    expect(s.snapshot?.status).toBe('WAITING');
  });

  it('another player being kicked does not exit me', () => {
    const s = reduce(lobby(), { event: 'room:member_left', payload: { userId: '00000000-0000-4000-8000-000000000009', reason: 'kicked' } });
    expect(s.exit).toBeNull();
  });
});

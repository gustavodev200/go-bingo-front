import type { RoomSnapshot } from '@/contracts';
import { initialGameState, reduce, selectCanClaim, selectDrawnSet, selectIsHost, selectReadyCount, type GameStoreState } from './store';

const ME = '00000000-0000-4000-8000-000000000001';
const ANA = '00000000-0000-4000-8000-000000000002';
const grid = Array.from({ length: 25 }, (_, i) => (i === 12 ? 0 : i + 1));

function snapshot(overrides: Partial<RoomSnapshot> = {}): RoomSnapshot {
  return {
    code: 'ABC234',
    name: 'Sala',
    hostId: ME,
    maxPlayers: 10,
    isPublic: true,
    status: 'IN_GAME',
    members: [
      { userId: ME, nickname: 'Eu', slot: 0, isGuest: false, connected: true, hasCard: true },
      { userId: ANA, nickname: 'Ana', slot: 1, isGuest: false, connected: true, hasCard: false },
    ],
    myCard: { id: '00000000-0000-4000-8000-0000000000aa', grid, marked: [] },
    game: { id: '00000000-0000-4000-8000-0000000000bb', drawn: [1], drawIntervalMs: 5000, remaining: { [ME]: 23, [ANA]: 24 } },
    ...overrides,
  };
}

function withSnapshot(s = snapshot()): GameStoreState {
  return reduce(initialGameState(ME), { event: 'room:state', payload: s });
}

describe('reduce', () => {
  it('appends drawn numbers and is idempotent', () => {
    const msg = { event: 'game:number_drawn', payload: { seq: 2, number: 7, letter: 'B', drawnAt: '' } } as const;
    const once = reduce(withSnapshot(), msg);
    const twice = reduce(once, msg);
    expect(twice.snapshot!.game!.drawn).toEqual([1, 7]);
  });

  it('marks members offline on disconnect and removes them on leave', () => {
    const offline = reduce(withSnapshot(), { event: 'room:member_left', payload: { userId: ANA, reason: 'disconnected' } });
    expect(offline.snapshot!.members.find((m) => m.userId === ANA)?.connected).toBe(false);
    const gone = reduce(offline, { event: 'room:member_left', payload: { userId: ANA, reason: 'expired' } });
    expect(gone.snapshot!.members.map((m) => m.userId)).toEqual([ME]);
  });

  it('upserts joining members ordered by slot', () => {
    const left = reduce(withSnapshot(), { event: 'room:member_left', payload: { userId: ANA, reason: 'left' } });
    const back = reduce(left, {
      event: 'room:member_joined',
      payload: { member: { userId: ANA, nickname: 'Ana', slot: 1, isGuest: false, connected: true, hasCard: false }, reconnected: false },
    });
    expect(back.snapshot!.members.map((m) => m.slot)).toEqual([0, 1]);
  });

  it('flags me as kicked and handles room closure', () => {
    const kicked = reduce(withSnapshot(), { event: 'room:member_left', payload: { userId: ME, reason: 'kicked' } });
    expect(kicked.exit).toEqual({ reason: 'kicked' });
    const closed = reduce(withSnapshot(), { event: 'room:closed', payload: { reason: 'host_cancelled' } });
    expect(closed.exit).toEqual({ reason: 'host_cancelled' });
  });

  it('records the winner and room:state clears the result', () => {
    const winner = { userId: ANA, nickname: 'Ana', pointsAwarded: 20, grid };
    const won = reduce(withSnapshot(), { event: 'game:won', payload: winner });
    expect(won.winner).toEqual(winner);
    expect(won.snapshot!.status).toBe('WAITING');
    const replay = reduce(won, { event: 'room:state', payload: snapshot({ status: 'WAITING', game: null, myCard: null }) });
    expect(replay.winner).toBeNull();
  });

  it('handles host change, ready and progress', () => {
    let s = reduce(withSnapshot(), { event: 'room:host_changed', payload: { hostId: ANA } });
    s = reduce(s, { event: 'room:member_ready', payload: { userId: ANA } });
    s = reduce(s, { event: 'game:progress', payload: { remaining: { [ME]: 1, [ANA]: 2 } } });
    expect(s.snapshot!.hostId).toBe(ANA);
    expect(selectReadyCount(s)).toBe(2);
    expect(s.snapshot!.game!.remaining[ME]).toBe(1);
  });

  it('ignores events before the first snapshot', () => {
    const s = reduce(initialGameState(ME), { event: 'game:number_drawn', payload: { seq: 1, number: 7, letter: 'B', drawnAt: '' } });
    expect(s.snapshot).toBeNull();
  });
});

describe('selectors', () => {
  it('canClaim only when all 24 non-free cells are marked during a game', () => {
    const allMarked = Array.from({ length: 25 }, (_, i) => i).filter((i) => i !== 12);
    const s = withSnapshot(snapshot({ myCard: { id: '00000000-0000-4000-8000-0000000000aa', grid, marked: allMarked } }));
    expect(selectCanClaim(s)).toBe(true);
    expect(selectCanClaim(withSnapshot())).toBe(false);
    expect(selectCanClaim(withSnapshot(snapshot({ status: 'WAITING', myCard: { id: '00000000-0000-4000-8000-0000000000aa', grid, marked: allMarked } })))).toBe(false);
  });

  it('exposes drawn set and host flag', () => {
    expect(selectDrawnSet(withSnapshot())).toEqual(new Set([1]));
    expect(selectIsHost(withSnapshot())).toBe(true);
  });
});

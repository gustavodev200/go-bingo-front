import type { RoomSnapshot } from '@/contracts';
import { initialGameState, MAX_REACTIONS, reduce, selectCanClaim, selectDrawnSet, selectIsHost, selectIsSpectator, selectMyRemaining, selectReadyCount, type GameStoreState } from './store';

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
    winPattern: 'FULL_CARD',
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
    const winner = { userId: ANA, nickname: 'Ana', pointsAwarded: 20, coinsAwarded: 100, grid };
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

  it('canClaim in Quina once a row, column or diagonal is marked (free center counts)', () => {
    const quina = (marked: number[]) => selectCanClaim(withSnapshot(snapshot({ winPattern: 'LINE', myCard: { id: '00000000-0000-4000-8000-0000000000aa', grid, marked } })));
    expect(quina([0, 1, 2, 3, 4])).toBe(true); // coluna B
    expect(quina([2, 7, 17, 22])).toBe(true); // linha do meio, passa pelo FREE
    expect(quina([0, 6, 18, 24])).toBe(true); // diagonal
    expect(quina([0, 1, 2, 3])).toBe(false);
    expect(quina([0, 6, 13, 19])).toBe(false);
  });

  it('exposes drawn set and host flag', () => {
    expect(selectDrawnSet(withSnapshot())).toEqual(new Set([1]));
    expect(selectIsHost(withSnapshot())).toBe(true);
  });
});

describe('selectCanClaim (o servidor manda)', () => {
  const ALL_BUT_FREE = Array.from({ length: 25 }, (_, i) => i).filter((i) => i !== 12);
  function game(left: number, marked: number[]) {
    return withSnapshot(snapshot({ myCard: { id: '00000000-0000-4000-8000-0000000000aa', grid, marked }, game: { id: '00000000-0000-4000-8000-0000000000bb', drawn: [1], drawIntervalMs: 5000, remaining: { [ME]: left, [ANA]: 24 } } }));
  }

  it('libera com 0 faltando mesmo sem nada marcado', () => expect(selectCanClaim(game(0, []))).toBe(true));
  it('libera pela marcação local completa antes do progress chegar', () => expect(selectCanClaim(game(2, ALL_BUT_FREE))).toBe(true));
  it('bloqueia com 1 faltando e marcação incompleta', () => expect(selectCanClaim(game(1, [0]))).toBe(false));
  it('não libera fora da partida mesmo com 0 faltando', () => {
    const s = game(0, []);
    expect(selectCanClaim({ ...s, snapshot: { ...s.snapshot!, status: 'WAITING' } })).toBe(false);
  });

  it('selectMyRemaining devolve o meu número, ou null sem cartela', () => {
    expect(selectMyRemaining(game(3, []))).toBe(3);
    const s = game(3, []);
    expect(selectMyRemaining({ ...s, snapshot: { ...s.snapshot!, myCard: null } })).toBeNull();
    expect(selectMyRemaining(withSnapshot(snapshot({ game: null })))).toBeNull();
  });
});

describe('espectador e fim sem jogadores', () => {
  it('quem está na partida sem cartela é espectador', () => {
    expect(selectIsSpectator(withSnapshot(snapshot({ myCard: null })))).toBe(true);
    expect(selectIsSpectator(withSnapshot())).toBe(false);
    expect(selectIsSpectator(withSnapshot(snapshot({ status: 'WAITING', myCard: null })))).toBe(false);
  });

  it('guarda o motivo do fim e zera no próximo snapshot', () => {
    const ended = reduce(withSnapshot(), { event: 'game:ended', payload: { reason: 'no_players' } });
    expect(ended.endReason).toBe('no_players');
    expect(ended.endedWithoutWinner).toBe(true);
    expect(reduce(ended, { event: 'room:state', payload: snapshot({ status: 'WAITING' }) }).endReason).toBeNull();
  });
});

describe('reações (emotes)', () => {
  const emoted = (userId: string, emote: 'clap' | 'fire' = 'clap') => ({ event: 'room:emoted', payload: { userId, emote } }) as const;

  it('guarda emotes de quem está na sala, com ids crescentes', () => {
    const one = reduce(withSnapshot(), emoted(ANA));
    const two = reduce(one, emoted(ME, 'fire'));
    expect(two.reactions).toEqual([
      { id: 1, userId: ANA, emote: 'clap' },
      { id: 2, userId: ME, emote: 'fire' },
    ]);
  });

  it('ignora emote de quem não é membro e emote antes do snapshot', () => {
    expect(reduce(withSnapshot(), emoted('00000000-0000-4000-8000-0000000000ff')).reactions).toEqual([]);
    expect(reduce(initialGameState(ME), emoted(ANA)).reactions).toEqual([]);
  });

  it('mantém só as últimas MAX_REACTIONS', () => {
    let s = withSnapshot();
    for (let i = 0; i < MAX_REACTIONS + 5; i++) s = reduce(s, emoted(ANA));
    expect(s.reactions).toHaveLength(MAX_REACTIONS);
    expect(s.reactions.at(-1)!.id).toBe(MAX_REACTIONS + 5);
  });
});

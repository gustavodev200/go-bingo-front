import { act, renderHook } from '@testing-library/react';
import type { RoomSnapshot } from '@/contracts';
import { FakeSocket, flush } from '@/test/fake-socket';
import { initialGameState, useGameStore } from './store';
import { useGameConnection } from './use-game-connection';

const ME = '00000000-0000-4000-8000-000000000001';
const ANA = '00000000-0000-4000-8000-000000000002';
const grid = Array.from({ length: 25 }, (_, i) => (i === 12 ? 0 : i + 1));
const snapshot: RoomSnapshot = {
  code: 'ABC234', name: 'Sala', hostId: ME, maxPlayers: 10, isPublic: true, status: 'WAITING',
  members: [{ userId: ME, nickname: 'Eu', slot: 0, isGuest: false, connected: true, hasCard: false }],
  myCard: null, game: null,
};

let socket: FakeSocket;
const toastError = vi.fn();
vi.mock('@/lib/socket', async (orig) => ({ ...(await orig<typeof import('@/lib/socket')>()), createGameSocket: () => socket.asSocket() }));
vi.mock('sonner', () => ({ toast: { error: (msg: string) => toastError(msg) } }));

async function connect(join: unknown = { ok: true, data: snapshot }) {
  socket.acks.set('room:join', join);
  const hook = renderHook(() => useGameConnection('ABC234'));
  await act(async () => {
    socket.fire('connect');
    await flush();
  });
  return hook;
}

describe('useGameConnection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    socket = new FakeSocket();
    useGameStore.setState(initialGameState(ME));
  });

  it('joins the room on connect and goes online with the snapshot', async () => {
    await connect();
    expect(socket.connected).toBe(true);
    expect(socket.emitted[0]).toEqual({ event: 'room:join', payload: { code: 'ABC234' } });
    expect(useGameStore.getState().snapshot?.code).toBe('ABC234');
    expect(useGameStore.getState().connection).toBe('online');
  });

  it('maps join failures to an exit reason', async () => {
    await connect({ ok: false, error: { code: 'NOT_FOUND', message: 'Sala não existe' } });
    expect(useGameStore.getState().exit).toEqual({ reason: 'not_found', message: 'Sala não existe' });

    socket = new FakeSocket();
    useGameStore.setState(initialGameState(ME));
    await connect({ ok: false, error: { code: 'ROOM_FULL', message: 'Sala cheia' } });
    expect(useGameStore.getState().exit).toEqual({ reason: 'error', message: 'Sala cheia' });
  });

  it('feeds server events into the store', async () => {
    await connect();
    act(() =>
      socket.fire('room:member_joined', { member: { userId: ANA, nickname: 'Ana', slot: 1, isGuest: true, connected: true, hasCard: false }, reconnected: false }),
    );
    expect(useGameStore.getState().snapshot?.members.map((m) => m.nickname)).toEqual(['Eu', 'Ana']);
  });

  it('shows reconnecting on disconnect and network errors, exits on expired session', async () => {
    await connect();
    act(() => socket.fire('disconnect'));
    expect(useGameStore.getState().connection).toBe('reconnecting');
    act(() => socket.fire('connect_error', new Error('xhr poll error')));
    expect(useGameStore.getState().exit).toBeNull();
    act(() => socket.fire('connect_error', new Error('UNAUTHENTICATED')));
    expect(useGameStore.getState().exit).toEqual({ reason: 'error', message: 'Sua sessão expirou. Entre de novo.' });
  });

  it('ignores a join ack that arrives after unmount', async () => {
    socket.acks.set('room:join', { ok: true, data: snapshot });
    const { unmount } = renderHook(() => useGameConnection('ABC234'));
    socket.fire('connect');
    unmount();
    await flush();
    expect(useGameStore.getState().snapshot).toBeNull();
    expect(socket.connected).toBe(false);
    expect(socket.listenerCount('connect')).toBe(0);
  });

  it('actions update the store from acks and toast errors', async () => {
    const { result } = await connect();
    const card = { id: '00000000-0000-4000-8000-0000000000aa', grid, marked: [] };
    socket.acks.set('card:generate', { ok: true, data: card });
    socket.acks.set('card:mark', { ok: true, data: { marked: [0] } });
    socket.acks.set('game:start', { ok: false, error: { code: 'NOT_ENOUGH_PLAYERS', message: 'Precisa de 2 prontos' } });
    for (const event of ['room:cancel', 'room:leave', 'room:kick', 'bingo:claim', 'game:replay']) socket.acks.set(event, { ok: true, data: null });

    await act(() => result.current.generateCard());
    expect(useGameStore.getState().snapshot?.myCard).toEqual(card);
    expect(useGameStore.getState().snapshot?.members[0].hasCard).toBe(true);

    await act(() => result.current.mark(0));
    expect(useGameStore.getState().snapshot?.myCard?.marked).toEqual([0]);

    await act(() => result.current.start());
    expect(toastError).toHaveBeenCalledWith('Precisa de 2 prontos');

    await act(async () => {
      await result.current.cancel();
      await result.current.leave();
      await result.current.kick(ANA);
      await result.current.claim();
      await result.current.replay();
    });
    expect(socket.emitted.map((e) => e.event)).toEqual(
      expect.arrayContaining(['room:cancel', 'room:leave', 'room:kick', 'bingo:claim', 'game:replay']),
    );
    expect(socket.emitted.find((e) => e.event === 'room:kick')?.payload).toEqual({ userId: ANA });
  });

  it('actions fail gracefully without a socket', async () => {
    const { result, unmount } = await connect();
    unmount();
    await act(() => result.current.start());
    expect(toastError).toHaveBeenCalledWith('Sem conexão');
  });
});

describe('useGameConnection robustness', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    socket = new FakeSocket();
    useGameStore.setState(initialGameState(ME));
  });

  it('ignores a room:state for another room the user still belongs to', async () => {
    await connect();
    act(() => socket.fire('room:state', { ...snapshot, code: 'ZZZ999', name: 'Outra sala' }));
    expect(useGameStore.getState().snapshot?.code).toBe('ABC234');
  });

  it('after an exit the socket disconnects and never rejoins', async () => {
    await connect();
    act(() => socket.fire('room:member_left', { userId: ME, reason: 'kicked' }));
    expect(useGameStore.getState().exit).toEqual({ reason: 'kicked' });
    expect(socket.connected).toBe(false);
    await act(async () => {
      socket.fire('connect');
      await flush();
    });
    expect(socket.emitted.filter((e) => e.event === 'room:join')).toHaveLength(1);
  });

  it('keeps events that arrive while the join is pending', async () => {
    let resolveJoin!: (ack: unknown) => void;
    const inGame: RoomSnapshot = { ...snapshot, status: 'IN_GAME', game: { id: '00000000-0000-4000-8000-0000000000bb', drawn: [3], drawIntervalMs: 5000, remaining: {} } };
    socket.acks.set('room:join', new Promise((resolve) => (resolveJoin = resolve)));
    renderHook(() => useGameConnection('ABC234'));
    act(() => socket.fire('connect'));
    act(() => socket.fire('game:number_drawn', { seq: 2, number: 7, letter: 'B', drawnAt: '' }));
    await act(async () => {
      resolveJoin({ ok: true, data: inGame });
      await flush();
    });
    expect(useGameStore.getState().snapshot?.game?.drawn).toEqual([3, 7]);
  });

  it('retries the join when the server does not answer instead of leaving', async () => {
    vi.useFakeTimers();
    try {
      renderHook(() => useGameConnection('ABC234'));
      await act(async () => {
        socket.fire('connect'); // sem ack configurado → timeout
        await vi.advanceTimersByTimeAsync(0);
      });
      expect(useGameStore.getState().exit).toBeNull();
      socket.acks.set('room:join', { ok: true, data: snapshot });
      await act(() => vi.advanceTimersByTimeAsync(5_000));
      expect(useGameStore.getState().snapshot?.code).toBe('ABC234');
      expect(useGameStore.getState().connection).toBe('online');
    } finally {
      vi.useRealTimers();
    }
  });

  it('gives up after repeated timeouts', async () => {
    vi.useFakeTimers();
    try {
      renderHook(() => useGameConnection('ABC234'));
      await act(async () => {
        socket.fire('connect');
        await vi.advanceTimersByTimeAsync(60_000);
      });
      expect(useGameStore.getState().exit?.reason).toBe('error');
    } finally {
      vi.useRealTimers();
    }
  });
});

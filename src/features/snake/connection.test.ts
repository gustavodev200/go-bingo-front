import { act, renderHook } from '@testing-library/react';
import { encodeSnakeFrame } from '@/contracts';
import { FakeSocket, flush } from '@/test/fake-socket';
import { useSnakeArena } from './connection';
import { useSnakeStore } from './store';
import { SnakeView } from './view';

const socket = new FakeSocket();
vi.mock('@/lib/socket', () => ({ createSocket: () => socket.asSocket() }));

const JOINED = {
  ok: true,
  data: { arena: 1, radius: 3000, meta: [[5, 'Bia', 2]] },
};
const lb = (extra = {}) => ({
  top: [{ id: 9, name: 'Top', score: 300 }],
  dots: [],
  total: 3,
  rank: 2,
  me: null,
  ...extra,
});

async function mount(join: unknown = JOINED) {
  socket.acks.set('snake:join', join);
  const view = new SnakeView();
  const hook = renderHook(() => useSnakeArena(view));
  await act(async () => {
    socket.fire('connect');
    await flush();
  });
  return { hook, view };
}

describe('useSnakeArena', () => {
  beforeEach(() => {
    vi.useRealTimers();
    socket.removeAllListeners();
    socket.acks.clear();
    socket.emitted.length = 0;
    socket.connected = false;
  });

  it('joins on connect and loads the arena', async () => {
    const { view } = await mount();
    expect(socket.emitted[0]).toEqual({ event: 'snake:join', payload: {} });
    expect(useSnakeStore.getState()).toMatchObject({
      connection: 'online',
      arena: 1,
      phase: 'menu',
    });
    socket.fire(
      'snake:frame',
      encodeSnakeFrame({
        tick: 1,
        myId: 0,
        myMass: 0,
        camX: 0,
        camY: 0,
        snakes: [
          {
            id: 5,
            radius: 12,
            boost: false,
            angle: 0,
            total: 1,
            idx: [0],
            xy: [1, 2],
          },
        ],
        foods: [],
      }),
    );
    expect(view.scene(10_000, 0)?.snakes[0]).toMatchObject({
      id: 5,
      name: 'Bia',
      skin: 2,
    });
  });

  it('plays, steers and reports the view size', async () => {
    const { hook, view } = await mount();
    socket.connected = true;
    socket.acks.set('snake:play', { ok: true, data: { id: 42 } });
    await act(async () => {
      expect(await hook.result.current.play(3)).toBeNull();
    });
    expect(view.myId).toBe(42);
    expect(useSnakeStore.getState()).toMatchObject({
      phase: 'playing',
      myId: 42,
    });
    hook.result.current.input(1.23456, true);
    hook.result.current.viewSize(1200.4, 800.6);
    expect(socket.emitted.slice(-2)).toEqual([
      { event: 'snake:input', payload: { a: 1.235, b: true } },
      { event: 'snake:view', payload: { w: 1200, h: 801 } },
    ]);
    socket.connected = false;
    hook.result.current.input(0, false);
    hook.result.current.viewSize(1, 1);
    expect(socket.emitted).toHaveLength(4);
  });

  it('returns the server message when it cannot play', async () => {
    const { hook } = await mount();
    socket.acks.set('snake:play', {
      ok: false,
      error: { code: 'NOT_IN_ROOM', message: 'Entre na arena primeiro' },
    });
    await act(async () => {
      expect(await hook.result.current.play(0)).toBe('Entre na arena primeiro');
    });
    expect(await hook.result.current.play(0)).toBe('Entre na arena primeiro');
    socket.acks.delete('snake:play');
    expect(await hook.result.current.play(0)).toBe('Sem resposta do servidor');
  });

  it('meta, leaderboard, feed and death update the view and the store', async () => {
    const { view } = await mount();
    useSnakeStore.getState().playing(42);
    view.myId = 42;
    act(() => {
      socket.fire('snake:meta', { meta: [[9, 'Top', 1]] });
      socket.fire('snake:leaderboard', lb());
      socket.fire('snake:feed', {
        killer: 'Top',
        victim: 'X',
        killerId: 9,
        victimId: 3,
      });
      socket.fire('snake:feed', {
        killer: 'A',
        victim: 'B',
        killerId: 100,
        victimId: 101,
      });
      socket.fire('snake:feed', {
        killer: null,
        victim: 'C',
        killerId: 0,
        victimId: 102,
      });
      socket.fire('snake:feed', {
        killer: 'Me',
        victim: 'D',
        killerId: 42,
        victimId: 103,
      });
    });
    const s = useSnakeStore.getState();
    expect(s.leaderboard?.rank).toBe(2);
    expect(s.feed.map((f) => f.victim)).toEqual(['D', 'X']);
    act(() =>
      socket.fire('snake:dead', {
        killer: 'Top',
        score: 50,
        kills: 1,
        rank: 4,
        secs: 30,
      }),
    );
    expect(useSnakeStore.getState()).toMatchObject({
      phase: 'dead',
      myId: 0,
      death: { killer: 'Top' },
    });
    expect(view.myId).toBe(0);
    act(() =>
      socket.fire('snake:feed', {
        killer: 'Top',
        victim: 'Y',
        killerId: 9,
        victimId: 4,
      }),
    );
    expect(useSnakeStore.getState().feed).toHaveLength(2);
  });

  it('a reconnection rejoins as spectator', async () => {
    await mount();
    useSnakeStore.getState().playing(42);
    act(() => socket.fire('disconnect'));
    expect(useSnakeStore.getState().connection).toBe('reconnecting');
    await act(async () => {
      socket.fire('connect');
      await flush();
    });
    expect(useSnakeStore.getState()).toMatchObject({
      connection: 'online',
      phase: 'menu',
      myId: 0,
    });
  });

  it('retries when the server does not answer, then shows fatal errors', async () => {
    vi.useFakeTimers();
    socket.acks.set('snake:join', {
      ok: false,
      error: { code: 'INTERNAL', message: 'x' },
    });
    renderHook(() => useSnakeArena(new SnakeView()));
    await act(async () => {
      socket.fire('connect');
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(useSnakeStore.getState().connection).toBe('reconnecting');
    socket.acks.set('snake:join', {
      ok: false,
      error: { code: 'ROOM_FULL', message: 'Todas as arenas estão cheias' },
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    expect(useSnakeStore.getState().error).toBe('Todas as arenas estão cheias');
  });

  it('connection errors: expired session is fatal, others just reconnect', async () => {
    await mount();
    act(() => socket.fire('connect_error', new Error('xhr poll error')));
    expect(useSnakeStore.getState()).toMatchObject({
      connection: 'reconnecting',
      error: null,
    });
    act(() => socket.fire('connect_error', new Error('UNAUTHENTICATED')));
    expect(useSnakeStore.getState().error).toMatch(/sessão expirou/);
  });

  it('joins right away on an open socket and disconnects on unmount', async () => {
    socket.connected = true;
    socket.acks.set('snake:join', JOINED);
    const hook = renderHook(() => useSnakeArena(new SnakeView()));
    await act(flush);
    expect(socket.emitted[0].event).toBe('snake:join');
    hook.unmount();
    expect(socket.connected).toBe(false);
    expect(socket.listenerCount('snake:frame')).toBe(0);
  });
});

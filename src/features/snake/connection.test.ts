import { act, renderHook } from '@testing-library/react';
import { encodeSnakeFrame, type SnakeRoomState } from '@/contracts';
import { FakeSocket, flush } from '@/test/fake-socket';
import { createSnakeRoom, usePublicSnakeRooms, useSnakeRoom } from './connection';
import { useSnakeStore } from './store';
import { SnakeView } from './view';

const socket = new FakeSocket();
const toastError = vi.fn();
vi.mock('@/lib/socket', () => ({ createSocket: () => socket.asSocket() }));
vi.mock('sonner', () => ({ toast: { error: (msg: string) => toastError(msg) } }));

const room = (extra: Partial<SnakeRoomState> = {}): SnakeRoomState => ({
  code: 'ABC234',
  isPublic: true,
  hostId: 'u1',
  players: [{ userId: 'u1', nickname: 'Ana', character: null, connected: true, playing: false }],
  version: 1,
  ...extra,
});
const JOINED = { ok: true, data: { state: room(), radius: 2000, meta: [[5, 'Bia', 2]] } };
const lb = (extra = {}) => ({ top: [{ id: 9, name: 'Top', score: 300 }], dots: [], total: 3, rank: 2, me: null, ...extra });

async function mount(join: unknown = JOINED) {
  socket.acks.set('snake:join', join);
  const view = new SnakeView();
  const hook = renderHook(() => useSnakeRoom('ABC234', view));
  await act(async () => {
    socket.fire('connect');
    await flush();
  });
  return { hook, view };
}

beforeEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
  socket.removeAllListeners();
  socket.acks.clear();
  socket.emitted.length = 0;
  socket.connected = false;
});

describe('useSnakeRoom', () => {
  it('joins the room on connect and loads it', async () => {
    const { view } = await mount();
    expect(socket.emitted[0]).toEqual({ event: 'snake:join', payload: { code: 'ABC234' } });
    expect(useSnakeStore.getState()).toMatchObject({ connection: 'online', phase: 'menu', radius: 2000, room: { code: 'ABC234' } });
    socket.fire('snake:frame', encodeSnakeFrame({ tick: 1, myId: 0, myMass: 0, camX: 0, camY: 0, snakes: [{ id: 5, radius: 12, boost: false, angle: 0, total: 1, idx: [0], xy: [1, 2] }], foods: [] }));
    expect(view.scene(10_000, 0)?.snakes[0]).toMatchObject({ id: 5, name: 'Bia', skin: 2 });
  });

  it('applies only newer room states', async () => {
    await mount();
    act(() => socket.fire('snake:state', room({ version: 5, isPublic: false })));
    act(() => socket.fire('snake:state', room({ version: 3, isPublic: true })));
    expect(useSnakeStore.getState().room?.isPublic).toBe(false);
  });

  it('plays, steers, reports the view size, changes visibility and leaves', async () => {
    const { hook, view } = await mount();
    socket.connected = true;
    socket.acks.set('snake:play', { ok: true, data: { id: 42 } });
    await act(async () => {
      expect(await hook.result.current.play(3)).toBeNull();
    });
    expect(view.myId).toBe(42);
    expect(useSnakeStore.getState()).toMatchObject({ phase: 'playing', myId: 42 });
    hook.result.current.input(1.23456, true);
    hook.result.current.viewSize(1200.4, 800.6);
    expect(socket.emitted.slice(-2)).toEqual([
      { event: 'snake:input', payload: { a: 1.235, b: true } },
      { event: 'snake:view', payload: { w: 1200, h: 801 } },
    ]);
    socket.connected = false;
    hook.result.current.input(0, false);
    hook.result.current.viewSize(1, 1);
    expect(socket.emitted.filter((e) => e.event === 'snake:input')).toHaveLength(1);

    socket.acks.set('snake:set_visibility', { ok: false, error: { code: 'NOT_HOST', message: 'Só o anfitrião' } });
    await act(() => hook.result.current.setVisibility(false));
    expect(toastError).toHaveBeenCalledWith('Só o anfitrião');
    socket.acks.set('snake:leave', { ok: false, error: { code: 'NOT_IN_ROOM', message: 'fora' } });
    await act(() => hook.result.current.leave());
    expect(useSnakeStore.getState().exit?.reason).toBe('left');
  });

  it('returns the server message when it cannot play', async () => {
    const { hook } = await mount();
    socket.acks.set('snake:play', { ok: false, error: { code: 'NOT_IN_ROOM', message: 'Você não está em uma sala' } });
    expect(await hook.result.current.play(0)).toBe('Você não está em uma sala');
  });

  it('meta, leaderboard, feed and death update the view and the store', async () => {
    const { view } = await mount();
    useSnakeStore.getState().playing(42);
    view.setMe(42);
    act(() => {
      socket.fire('snake:meta', { meta: [[9, 'Top', 1]] });
      socket.fire('snake:leaderboard', lb());
      socket.fire('snake:feed', { killer: 'Top', victim: 'X', killerId: 9, victimId: 3 });
      socket.fire('snake:feed', { killer: 'A', victim: 'B', killerId: 100, victimId: 101 });
      socket.fire('snake:feed', { killer: null, victim: 'C', killerId: 0, victimId: 102 });
      socket.fire('snake:feed', { killer: 'Me', victim: 'D', killerId: 42, victimId: 103 });
    });
    expect(useSnakeStore.getState().leaderboard?.rank).toBe(2);
    expect(useSnakeStore.getState().feed.map((f) => f.victim)).toEqual(['D', 'X']);
    act(() => socket.fire('snake:dead', { killer: 'Top', score: 50, kills: 1, rank: 4, secs: 30 }));
    expect(useSnakeStore.getState()).toMatchObject({ phase: 'dead', myId: 0, death: { killer: 'Top' } });
    expect(view.myId).toBe(0);
    act(() => socket.fire('snake:feed', { killer: 'Top', victim: 'Y', killerId: 9, victimId: 4 }));
    expect(useSnakeStore.getState().feed).toHaveLength(2);
  });

  it('a reconnection joins again and returns to the menu', async () => {
    await mount();
    useSnakeStore.getState().playing(42);
    act(() => socket.fire('disconnect'));
    expect(useSnakeStore.getState().connection).toBe('reconnecting');
    await act(async () => {
      socket.fire('connect');
      await flush();
    });
    expect(useSnakeStore.getState()).toMatchObject({ connection: 'online', phase: 'menu', myId: 0 });
  });

  it('maps join errors to exits and stops joining', async () => {
    await mount({ ok: false, error: { code: 'ROOM_FULL', message: 'A sala está cheia' } });
    expect(useSnakeStore.getState().exit).toEqual({ reason: 'full', message: 'A sala está cheia' });
    await act(async () => {
      socket.fire('connect');
      await flush();
    });
    expect(socket.emitted.filter((e) => e.event === 'snake:join')).toHaveLength(1);
  });

  it('retries when the server does not answer', async () => {
    vi.useFakeTimers();
    socket.acks.set('snake:join', { ok: false, error: { code: 'INTERNAL', message: 'x' } });
    renderHook(() => useSnakeRoom('ABC234', new SnakeView()));
    await act(async () => {
      socket.fire('connect');
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(useSnakeStore.getState().connection).toBe('reconnecting');
    socket.acks.set('snake:join', { ok: false, error: { code: 'NOT_FOUND', message: 'Sala não encontrada' } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    expect(useSnakeStore.getState().exit?.reason).toBe('not_found');
  });

  it('connection errors: expired session is fatal, others just reconnect', async () => {
    await mount();
    act(() => socket.fire('connect_error', new Error('xhr poll error')));
    expect(useSnakeStore.getState()).toMatchObject({ connection: 'reconnecting', exit: null });
    act(() => socket.fire('connect_error', new Error('UNAUTHENTICATED')));
    expect(useSnakeStore.getState().exit?.message).toMatch(/sessão expirou/);
  });

  it('joins right away on an open socket and disconnects on unmount', async () => {
    socket.connected = true;
    socket.acks.set('snake:join', JOINED);
    const hook = renderHook(() => useSnakeRoom('ABC234', new SnakeView()));
    await act(flush);
    expect(socket.emitted[0].event).toBe('snake:join');
    hook.unmount();
    expect(socket.connected).toBe(false);
    expect(socket.listenerCount('snake:frame')).toBe(0);
  });
});

describe('createSnakeRoom', () => {
  it('connects and creates', async () => {
    socket.acks.set('snake:create', { ok: true, data: { state: room(), radius: 2000, meta: [] } });
    const res = createSnakeRoom(false);
    await flush();
    socket.connected = true;
    socket.fire('connect');
    expect(await res).toMatchObject({ ok: true });
    expect(socket.emitted.at(-1)).toEqual({ event: 'snake:create', payload: { isPublic: false } });
  });

  it('gives up when the server is unreachable', async () => {
    const res = createSnakeRoom(true);
    await flush();
    socket.fire('connect_error', new Error('down'));
    expect(await res).toMatchObject({ ok: false, error: { message: 'Sem conexão com o servidor' } });
  });
});

describe('usePublicSnakeRooms', () => {
  it('watches the list live and stops on unmount', async () => {
    const list = [{ code: 'ABC234', hostNickname: 'Ana', hostCharacter: null, players: 3 }];
    socket.acks.set('snake:watch_rooms', { ok: true, data: list });
    socket.acks.set('snake:unwatch_rooms', { ok: true, data: null });
    const hook = renderHook(() => usePublicSnakeRooms());
    expect(hook.result.current).toBeNull();
    await act(async () => {
      socket.connected = true;
      socket.fire('connect');
      await flush();
    });
    expect(hook.result.current).toEqual(list);
    act(() => socket.fire('snake:rooms_updated', { rooms: [] }));
    expect(hook.result.current).toEqual([]);
    hook.unmount();
    expect(socket.emitted.at(-1)?.event).toBe('snake:unwatch_rooms');
  });
});

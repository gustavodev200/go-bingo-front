import { act, renderHook } from '@testing-library/react';
import { FakeSocket, flush } from '@/test/fake-socket';
import { frame, roomState } from '@/test/bomber-fixtures';
import { createBomberRoom, useBomberRoom, usePublicBomberRooms, type BomberListeners } from './connection';
import { useBomberStore } from './store';

const socket = new FakeSocket();
const toastError = vi.fn();
vi.mock('@/lib/socket', () => ({ createSocket: () => socket.asSocket() }));
vi.mock('sonner', () => ({ toast: { error: (msg: string) => toastError(msg) } }));

const snapshot = { state: roomState(), mySeat: 0, frame: frame() };

function listeners(): BomberListeners {
  return { onAnnouncement: vi.fn(), onFrame: vi.fn() };
}

async function mount(join: unknown = { ok: true, data: snapshot }, l = listeners()) {
  socket.acks.set('bomber:join', join);
  const hook = renderHook(() => useBomberRoom('ABC234', l));
  await act(async () => {
    socket.fire('connect');
    await flush();
  });
  return { hook, l };
}

describe('useBomberRoom', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    socket.removeAllListeners();
    socket.acks.clear();
    socket.emitted.length = 0;
    socket.connected = false;
  });

  it('joins on connect, applies the snapshot and replays its frame', async () => {
    const { l } = await mount();
    expect(socket.emitted[0]).toEqual({ event: 'bomber:join', payload: { code: 'ABC234' } });
    expect(useBomberStore.getState()).toMatchObject({ connection: 'online', mySeat: 0 });
    expect(l.onFrame).toHaveBeenCalledWith(snapshot.frame);
  });

  it('routes states and frames, and each announcement once', async () => {
    const { l } = await mount();
    const msg = { seq: 3, roundNumber: 2 };
    act(() => {
      socket.fire('bomber:state', roomState({ version: 5, roundNumber: 2 }));
      socket.fire('bomber:frame', frame({ roundNumber: 2 }));
      socket.fire('bomber:round_started', msg);
      socket.fire('bomber:round_started', msg);
    });
    expect(useBomberStore.getState().state!.roundNumber).toBe(2);
    expect(l.onFrame).toHaveBeenCalledTimes(2);
    expect(l.onAnnouncement).toHaveBeenCalledTimes(1);
    act(() => socket.fire('bomber:room_closed', { reason: 'empty' }));
    expect(useBomberStore.getState().exit?.reason).toBe('not_found');
  });

  it('queues events that arrive before the join answer', async () => {
    socket.acks.set('bomber:join', { ok: true, data: snapshot });
    const l = listeners();
    renderHook(() => useBomberRoom('ABC234', l));
    await act(async () => {
      socket.fire('connect');
      socket.fire('bomber:frame', frame({ timeLeft: 99 }));
      await flush();
    });
    expect(l.onFrame).toHaveBeenLastCalledWith(expect.objectContaining({ timeLeft: 99 }));
  });

  it('exits on a refused join and retries on silence', async () => {
    await mount({ ok: false, error: { code: 'ROOM_FULL', message: 'A sala está cheia' } });
    expect(useBomberStore.getState().exit).toEqual({ reason: 'full', message: 'A sala está cheia' });

    vi.useFakeTimers();
    socket.removeAllListeners();
    socket.acks.clear();
    renderHook(() => useBomberRoom('ABC234', listeners()));
    await act(async () => {
      socket.fire('connect');
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(useBomberStore.getState().connection).toBe('reconnecting');
    socket.acks.set('bomber:join', { ok: true, data: snapshot });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_100);
    });
    expect(useBomberStore.getState().connection).toBe('online');
    vi.useRealTimers();
  });

  it('tracks disconnects and expired sessions', async () => {
    await mount();
    act(() => socket.fire('disconnect'));
    expect(useBomberStore.getState().connection).toBe('reconnecting');
    act(() => socket.fire('connect_error', new Error('boom')));
    expect(useBomberStore.getState().connection).toBe('reconnecting');
    act(() => socket.fire('connect_error', new Error('UNAUTHENTICATED')));
    expect(useBomberStore.getState().exit?.message).toMatch(/sessão expirou/);
  });

  it('actions emit with ack, toast errors and send inputs without ack', async () => {
    const { hook } = await mount();
    socket.connected = true;
    for (const event of ['bomber:ready', 'bomber:set_rules', 'bomber:set_visibility', 'bomber:set_color', 'bomber:add_bot', 'bomber:remove_bot', 'bomber:start', 'bomber:rematch', 'bomber:leave'])
      socket.acks.set(event, { ok: true, data: null });
    const a = hook.result.current;
    await act(async () => {
      await a.ready(true);
      await a.setRules({ winsToWin: 2 });
      await a.setVisibility(false);
      await a.setColor(4);
      await a.addBot();
      await a.removeBot(3);
      await a.start();
      await a.rematch();
    });
    expect(socket.emitted.map((e) => e.event)).toEqual(expect.arrayContaining(['bomber:set_color', 'bomber:remove_bot']));
    a.input(9, { d: 4, b: true, a: false });
    expect(socket.emitted.at(-1)).toEqual({ event: 'bomber:input', payload: { s: 9, d: 4, b: true, a: false } });
    socket.acks.set('bomber:start', { ok: false, error: { code: 'NOT_HOST', message: 'Só o anfitrião' } });
    await act(async () => {
      expect(await a.start()).toBe(false);
    });
    expect(toastError).toHaveBeenCalledWith('Só o anfitrião');
    await act(async () => {
      await a.leave();
    });
    expect(useBomberStore.getState().exit?.reason).toBe('left');
    socket.connected = false;
    const before = socket.emitted.length;
    a.input(10, { d: 0, b: false, a: false });
    expect(socket.emitted).toHaveLength(before);
    hook.unmount();
  });
});

describe('lobby helpers', () => {
  beforeEach(() => {
    socket.removeAllListeners();
    socket.acks.clear();
    socket.emitted.length = 0;
    socket.connected = false;
  });

  it('createBomberRoom connects first and reports a dead server', async () => {
    socket.acks.set('bomber:create', { ok: true, data: snapshot });
    const pending = createBomberRoom(false);
    socket.fire('connect');
    await expect(pending).resolves.toMatchObject({ ok: true });
    expect(socket.emitted.at(-1)).toEqual({ event: 'bomber:create', payload: { isPublic: false } });
    socket.connected = false;
    socket.removeAllListeners();
    const failing = createBomberRoom(true);
    socket.fire('connect_error');
    await expect(failing).resolves.toMatchObject({ ok: false, error: { code: 'INTERNAL' } });
  });

  it('usePublicBomberRooms watches the list while mounted', async () => {
    socket.acks.set('bomber:watch_rooms', { ok: true, data: [] });
    socket.acks.set('bomber:unwatch_rooms', { ok: true, data: null });
    const hook = renderHook(() => usePublicBomberRooms());
    expect(hook.result.current).toBeNull();
    await act(async () => {
      socket.fire('connect');
      await flush();
    });
    expect(hook.result.current).toEqual([]);
    const room = { code: 'ABC234', hostNickname: 'Ana', hostCharacter: null, players: 2, rules: { winsToWin: 3 } };
    act(() => socket.fire('bomber:rooms_updated', { rooms: [room] }));
    expect(hook.result.current).toEqual([room]);
    socket.connected = true;
    hook.unmount();
    await flush();
    expect(socket.emitted.at(-1)?.event).toBe('bomber:unwatch_rooms');
  });
});

describe('useBomberStore', () => {
  it('ignores stale states and follows my seat by user id', () => {
    const s = useBomberStore.getState();
    s.reset();
    s.applySnapshot({ state: roomState({ version: 3 }), mySeat: 1, frame: null });
    s.applyState(roomState({ version: 2, roundNumber: 9 }));
    expect(useBomberStore.getState().state!.roundNumber).toBe(1);
    const moved = roomState({ version: 4 });
    moved.seats = [moved.seats[1], null, null, null, null, null, null, null];
    s.applyState(moved);
    expect(useBomberStore.getState().mySeat).toBe(0);
    expect(s.accept(1)).toBe(true);
    expect(s.accept(1)).toBe(false);
    s.applySnapshot({ state: roomState({ code: 'ZZZ999' }), mySeat: 0, frame: null });
    expect(useBomberStore.getState().lastSeq).toBe(0);
  });
});

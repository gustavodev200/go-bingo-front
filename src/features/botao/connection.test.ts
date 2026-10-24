import { act, renderHook } from '@testing-library/react';
import { FakeSocket, flush } from '@/test/fake-socket';
import { frame, roomState } from '@/test/botao-fixtures';
import { createBotaoRoom, useBotaoRoom, usePublicBotaoRooms, type BotaoListeners } from './connection';
import { useBotaoStore } from './store';

const socket = new FakeSocket();
const toastError = vi.fn();
vi.mock('@/lib/socket', () => ({ createSocket: () => socket.asSocket() }));
vi.mock('sonner', () => ({ toast: { error: (msg: string) => toastError(msg) } }));

const snapshot = { state: roomState(), mySeat: 0, frame: frame() };

function listeners(): BotaoListeners {
  return { onAnnouncement: vi.fn(), onFrame: vi.fn() };
}

async function mount(join: unknown = { ok: true, data: snapshot }, l = listeners()) {
  socket.acks.set('botao:join', join);
  const hook = renderHook(() => useBotaoRoom('ABC234', l));
  await act(async () => {
    socket.fire('connect');
    await flush();
  });
  return { hook, l };
}

describe('useBotaoRoom', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    socket.removeAllListeners();
    socket.acks.clear();
    socket.emitted.length = 0;
    socket.connected = false;
  });

  it('joins on connect, applies the snapshot and replays its frame', async () => {
    const { l } = await mount();
    expect(socket.emitted[0]).toEqual({ event: 'botao:join', payload: { code: 'ABC234' } });
    expect(useBotaoStore.getState()).toMatchObject({ connection: 'online', mySeat: 0 });
    expect(l.onFrame).toHaveBeenCalledWith(snapshot.frame);
  });

  it('routes states and frames, and each announcement once', async () => {
    const { l } = await mount();
    const msg = { seq: 3, goal: { team: 0, scorer: 0, own: false, at: 10 }, score: [1, 0] };
    act(() => {
      socket.fire('botao:state', roomState({ version: 5, score: [1, 0] }));
      socket.fire('botao:frame', frame({ score: [1, 0] }));
      socket.fire('botao:goal', msg);
      socket.fire('botao:goal', msg);
    });
    expect(useBotaoStore.getState().state!.score).toEqual([1, 0]);
    expect(l.onFrame).toHaveBeenCalledTimes(2);
    expect(l.onAnnouncement).toHaveBeenCalledTimes(1);
    act(() => socket.fire('botao:room_closed', { reason: 'empty' }));
    expect(useBotaoStore.getState().exit?.reason).toBe('not_found');
  });

  it('queues events that arrive before the join answer', async () => {
    socket.acks.set('botao:join', { ok: true, data: snapshot });
    const l = listeners();
    renderHook(() => useBotaoRoom('ABC234', l));
    await act(async () => {
      socket.fire('connect');
      socket.fire('botao:frame', frame({ clock: 99 }));
      await flush();
    });
    expect(l.onFrame).toHaveBeenLastCalledWith(expect.objectContaining({ clock: 99 }));
  });

  it('exits on a refused join and retries on silence', async () => {
    await mount({ ok: false, error: { code: 'ROOM_FULL', message: 'A sala está cheia' } });
    expect(useBotaoStore.getState().exit).toEqual({ reason: 'full', message: 'A sala está cheia' });

    vi.useFakeTimers();
    socket.removeAllListeners();
    socket.acks.clear();
    renderHook(() => useBotaoRoom('ABC234', listeners()));
    await act(async () => {
      socket.fire('connect');
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(useBotaoStore.getState().connection).toBe('reconnecting');
    socket.acks.set('botao:join', { ok: true, data: snapshot });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_100);
    });
    expect(useBotaoStore.getState().connection).toBe('online');
    vi.useRealTimers();
  });

  it('tracks disconnects and expired sessions', async () => {
    await mount();
    act(() => socket.fire('disconnect'));
    expect(useBotaoStore.getState().connection).toBe('reconnecting');
    act(() => socket.fire('connect_error', new Error('boom')));
    expect(useBotaoStore.getState().connection).toBe('reconnecting');
    act(() => socket.fire('connect_error', new Error('UNAUTHENTICATED')));
    expect(useBotaoStore.getState().exit?.message).toMatch(/sessão expirou/);
  });

  it('actions emit with ack, toast errors and send inputs without ack', async () => {
    const { hook } = await mount();
    socket.connected = true;
    for (const event of ['botao:ready', 'botao:set_rules', 'botao:set_visibility', 'botao:set_team', 'botao:add_bot', 'botao:remove_bot', 'botao:start', 'botao:rematch', 'botao:leave'])
      socket.acks.set(event, { ok: true, data: null });
    const a = hook.result.current;
    await act(async () => {
      await a.ready(true);
      await a.setRules({ minutes: 5, goals: 0 });
      await a.setVisibility(false);
      await a.setTeam(1);
      await a.addBot();
      await a.addBot(0);
      await a.removeBot(3);
      await a.start();
      await a.rematch();
    });
    expect(socket.emitted.map((e) => e.event)).toEqual(expect.arrayContaining(['botao:set_team', 'botao:remove_bot']));
    expect(socket.emitted.filter((e) => e.event === 'botao:add_bot').map((e) => e.payload)).toEqual([{}, { team: 0 }]);
    a.input(9, { d: 8, k: true });
    expect(socket.emitted.at(-1)).toEqual({ event: 'botao:input', payload: { s: 9, d: 8, k: true } });
    socket.acks.set('botao:start', { ok: false, error: { code: 'NOT_HOST', message: 'Só o anfitrião' } });
    await act(async () => {
      expect(await a.start()).toBe(false);
    });
    expect(toastError).toHaveBeenCalledWith('Só o anfitrião');
    await act(async () => {
      await a.leave();
    });
    expect(useBotaoStore.getState().exit?.reason).toBe('left');
    socket.connected = false;
    const before = socket.emitted.length;
    a.input(10, { d: 0, k: false });
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

  it('createBotaoRoom connects first and reports a dead server', async () => {
    socket.acks.set('botao:create', { ok: true, data: snapshot });
    const pending = createBotaoRoom(false);
    socket.fire('connect');
    await expect(pending).resolves.toMatchObject({ ok: true });
    expect(socket.emitted.at(-1)).toEqual({ event: 'botao:create', payload: { isPublic: false } });
    socket.connected = false;
    socket.removeAllListeners();
    const failing = createBotaoRoom(true);
    socket.fire('connect_error');
    await expect(failing).resolves.toMatchObject({ ok: false, error: { code: 'INTERNAL' } });
  });

  it('usePublicBotaoRooms watches the list while mounted', async () => {
    socket.acks.set('botao:watch_rooms', { ok: true, data: [] });
    socket.acks.set('botao:unwatch_rooms', { ok: true, data: null });
    const hook = renderHook(() => usePublicBotaoRooms());
    expect(hook.result.current).toBeNull();
    await act(async () => {
      socket.fire('connect');
      await flush();
    });
    expect(hook.result.current).toEqual([]);
    const room = { code: 'ABC234', hostNickname: 'Ana', hostCharacter: null, players: 2, rules: { winsToWin: 3 } };
    act(() => socket.fire('botao:rooms_updated', { rooms: [room] }));
    expect(hook.result.current).toEqual([room]);
    socket.connected = true;
    hook.unmount();
    await flush();
    expect(socket.emitted.at(-1)?.event).toBe('botao:unwatch_rooms');
  });
});

describe('useBotaoStore', () => {
  it('ignores stale states and follows my seat by user id', () => {
    const s = useBotaoStore.getState();
    s.reset();
    s.applySnapshot({ state: roomState({ version: 3 }), mySeat: 4, frame: null });
    s.applyState(roomState({ version: 2, score: [9, 9] }));
    expect(useBotaoStore.getState().state!.score).toEqual([0, 0]);
    const moved = roomState({ version: 4 });
    moved.seats = [moved.seats[4], null, null, null, null, null, null, null];
    s.applyState(moved);
    expect(useBotaoStore.getState().mySeat).toBe(0);
    expect(s.accept(1)).toBe(true);
    expect(s.accept(1)).toBe(false);
    s.applySnapshot({ state: roomState({ code: 'ZZZ999' }), mySeat: 0, frame: null });
    expect(useBotaoStore.getState().lastSeq).toBe(0);
  });
});

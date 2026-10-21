import { act, renderHook } from '@testing-library/react';
import { FakeSocket, flush } from '@/test/fake-socket';
import { privateHand, roomState } from '@/test/gauderio-fixtures';
import { createTable, usePublicTables, useGaudRoom, type GaudListeners } from './connection';
import { useGaudStore } from './store';

const socket = new FakeSocket();
const toastError = vi.fn();
vi.mock('@/lib/socket', () => ({ createSocket: () => socket.asSocket() }));
vi.mock('sonner', () => ({ toast: { error: (msg: string) => toastError(msg) } }));

const snapshot = { state: roomState(), mySeat: 0, hand: privateHand() };

function listeners(): GaudListeners {
  return { onAnnouncement: vi.fn(), onChat: vi.fn(), onError: vi.fn() };
}

async function mount(join: unknown = { ok: true, data: snapshot }, l = listeners()) {
  socket.acks.set('gauderio:join', join);
  const hook = renderHook(() => useGaudRoom('ABC234', l));
  await act(async () => {
    socket.fire('connect');
    await flush();
  });
  return { hook, l };
}

describe('useGaudRoom', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    socket.removeAllListeners();
    socket.acks.clear();
    socket.emitted.length = 0;
    socket.connected = false;
  });

  it('joins on connect and applies the snapshot', async () => {
    await mount();
    expect(socket.emitted[0]).toEqual({ event: 'gauderio:join', payload: { code: 'ABC234' } });
    expect(useGaudStore.getState()).toMatchObject({ connection: 'online', mySeat: 0 });
    expect(useGaudStore.getState().hand!.cards).toHaveLength(3);
  });

  it('forwards each announcement once, even when the server repeats it', async () => {
    const { l } = await mount();
    const msg = { seq: 7, seat: 1, team: 1, call: 'truco' };
    act(() => {
      socket.fire('gauderio:called', msg);
      socket.fire('gauderio:called', msg);
    });
    expect(l.onAnnouncement).toHaveBeenCalledTimes(1);
    expect(l.onAnnouncement).toHaveBeenCalledWith({ event: 'gauderio:called', payload: msg });
  });

  it('routes states, hands and chat', async () => {
    const { l } = await mount();
    act(() => {
      socket.fire('gauderio:state', roomState({ version: 2, scores: [4, 2] }));
      socket.fire('gauderio:private_hand', privateHand({ handNumber: 2 }));
    });
    expect(useGaudStore.getState().state!.scores).toEqual([4, 2]);
    expect(useGaudStore.getState().hand!.handNumber).toBe(2);
    act(() => socket.fire('gauderio:chat_message', { seat: 1, to: 'table', text: 'Bah!', bot: true }));
    expect(l.onChat).toHaveBeenCalledWith({ seat: 1, to: 'table', text: 'Bah!', bot: true });
    act(() => socket.fire('gauderio:room_closed', { reason: 'empty' }));
    expect(useGaudStore.getState().exit!.reason).toBe('not_found');
  });

  it('marks the connection as reconnecting and rejoins on the next connect', async () => {
    await mount();
    act(() => socket.fire('disconnect'));
    expect(useGaudStore.getState().connection).toBe('reconnecting');
    await act(async () => {
      socket.fire('connect');
      await flush();
    });
    expect(socket.emitted.filter((e) => e.event === 'gauderio:join')).toHaveLength(2);
    expect(useGaudStore.getState().connection).toBe('online');
  });

  it.each([
    ['NOT_FOUND', 'not_found'],
    ['ROOM_FULL', 'full'],
    ['GAME_IN_PROGRESS', 'in_progress'],
    ['INVALID_STATE', 'error'],
  ])('maps a %s join error to an exit screen', async (code, reason) => {
    await mount({ ok: false, error: { code, message: 'x' } });
    expect(useGaudStore.getState().exit).toEqual({ reason, message: 'x' });
  });

  it('expires the session on an auth error', async () => {
    await mount();
    act(() => socket.fire('connect_error', new Error('UNAUTHENTICATED')));
    expect(useGaudStore.getState().exit!.reason).toBe('error');
  });

  it('sends game actions with a fresh actionId and reports failures', async () => {
    const { hook, l } = await mount();
    socket.acks.set('gauderio:play_card', { ok: false, error: { code: 'NOT_YOUR_TURN', message: 'Não é a sua vez' } });
    await act(async () => {
      await hook.result.current.playCard('h1s0c0');
    });
    socket.acks.set('gauderio:respond', { ok: true, data: null });
    socket.acks.set('gauderio:call', { ok: true, data: null });
    socket.acks.set('gauderio:fold', { ok: true, data: null });
    await act(async () => {
      await hook.result.current.respond(true);
      await hook.result.current.respond(true);
      await hook.result.current.call('envido');
      await hook.result.current.fold();
    });
    expect(socket.emitted.find((e) => e.event === 'gauderio:call')!.payload).toMatchObject({ call: 'envido' });
    const plays = socket.emitted.filter((e) => e.event === 'gauderio:play_card');
    expect(plays[0].payload).toMatchObject({ cardId: 'h1s0c0', hidden: false, actionId: expect.any(String) });
    const ids = socket.emitted.filter((e) => e.event === 'gauderio:respond').map((e) => (e.payload as { actionId: string }).actionId);
    expect(new Set(ids).size).toBe(2);
    expect(toastError).toHaveBeenCalledWith('Não é a sua vez');
    expect(l.onError).toHaveBeenCalledTimes(1);
  });

  it('leaves the table and disconnects on unmount', async () => {
    const { hook } = await mount();
    socket.acks.set('gauderio:leave', { ok: true, data: null });
    await act(async () => {
      await hook.result.current.leave();
    });
    expect(useGaudStore.getState().exit!.reason).toBe('left');
    hook.unmount();
    expect(socket.connected).toBe(false);
    expect(socket.listenerCount('gauderio:state')).toBe(0);
  });
});

describe('createTable', () => {
  it('connects and creates a table', async () => {
    socket.acks.set('gauderio:create', { ok: true, data: snapshot });
    const pending = createTable(false, { size: 4, target: 24, flor: false });
    socket.fire('connect');
    await expect(pending).resolves.toEqual({ ok: true, data: snapshot });
    expect(socket.emitted.at(-1)).toEqual({ event: 'gauderio:create', payload: { isPublic: false, settings: { size: 4, target: 24, flor: false } } });
  });

  it('reports when the server cannot be reached', async () => {
    socket.connected = false;
    socket.removeAllListeners();
    const pending = createTable(true, { size: 2, target: 12, flor: true });
    socket.fire('connect_error', new Error('down'));
    await expect(pending).resolves.toMatchObject({ ok: false });
  });
});

describe('usePublicTables', () => {
  const room = { code: 'QWE234', hostNickname: 'Ana', hostCharacter: null, players: 2 };

  beforeEach(() => {
    socket.removeAllListeners();
    socket.acks.clear();
    socket.emitted.length = 0;
    socket.connected = false;
  });

  it('watches the public list, follows live updates and unwatches on unmount', async () => {
    socket.acks.set('gauderio:watch_rooms', { ok: true, data: [room] });
    socket.acks.set('gauderio:unwatch_rooms', { ok: true, data: null });
    const hook = renderHook(() => usePublicTables());
    expect(hook.result.current).toBeNull();
    await act(async () => {
      socket.fire('connect');
      await flush();
    });
    expect(hook.result.current).toEqual([room]);
    act(() => socket.fire('gauderio:rooms_updated', { rooms: [] }));
    expect(hook.result.current).toEqual([]);
    hook.unmount();
    expect(socket.emitted.map((e) => e.event)).toEqual(['gauderio:watch_rooms', 'gauderio:unwatch_rooms']);
    expect(socket.listenerCount('gauderio:rooms_updated')).toBe(0);
  });
});

import { act, renderHook } from '@testing-library/react';
import { FakeSocket, flush } from '@/test/fake-socket';
import { privateHand, roomState } from '@/test/truco-fixtures';
import { createTable, useTrucoRoom, type TrucoListeners } from './connection';
import { useTrucoStore } from './store';

const socket = new FakeSocket();
const toastError = vi.fn();
vi.mock('@/lib/socket', () => ({ createSocket: () => socket.asSocket() }));
vi.mock('sonner', () => ({ toast: { error: (msg: string) => toastError(msg) } }));

const snapshot = { state: roomState(), mySeat: 0, hand: privateHand() };

function listeners(): TrucoListeners {
  return { onAnnouncement: vi.fn(), onSignal: vi.fn(), onGesture: vi.fn(), onError: vi.fn() };
}

async function mount(join: unknown = { ok: true, data: snapshot }, l = listeners()) {
  socket.acks.set('truco:join', join);
  const hook = renderHook(() => useTrucoRoom('ABC234', l));
  await act(async () => {
    socket.fire('connect');
    await flush();
  });
  return { hook, l };
}

describe('useTrucoRoom', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    socket.removeAllListeners();
    socket.acks.clear();
    socket.emitted.length = 0;
    socket.connected = false;
  });

  it('joins on connect and applies the snapshot', async () => {
    await mount();
    expect(socket.emitted[0]).toEqual({ event: 'truco:join', payload: { code: 'ABC234' } });
    expect(useTrucoStore.getState()).toMatchObject({ connection: 'online', mySeat: 0 });
    expect(useTrucoStore.getState().hand!.cards).toHaveLength(3);
  });

  it('forwards each announcement once, even when the server repeats it', async () => {
    const { l } = await mount();
    const msg = { seq: 7, seat: 1, team: 1, value: 4 };
    act(() => {
      socket.fire('truco:bet_requested', msg);
      socket.fire('truco:bet_requested', msg);
    });
    expect(l.onAnnouncement).toHaveBeenCalledTimes(1);
    expect(l.onAnnouncement).toHaveBeenCalledWith({ event: 'truco:bet_requested', payload: msg });
  });

  it('routes states, hands, signals and gestures', async () => {
    const { l } = await mount();
    act(() => {
      socket.fire('truco:state', roomState({ version: 2, scores: [4, 2] }));
      socket.fire('truco:private_hand', privateHand({ handNumber: 2 }));
      socket.fire('truco:signal_received', { fromSeat: 2, gesture: 'wink' });
      socket.fire('truco:gestured', { seat: 1 });
    });
    expect(useTrucoStore.getState().state!.scores).toEqual([4, 2]);
    expect(useTrucoStore.getState().hand!.handNumber).toBe(2);
    expect(l.onSignal).toHaveBeenCalledWith({ fromSeat: 2, gesture: 'wink' });
    expect(l.onGesture).toHaveBeenCalledWith({ seat: 1 });
    act(() => socket.fire('truco:room_closed', { reason: 'empty' }));
    expect(useTrucoStore.getState().exit!.reason).toBe('not_found');
  });

  it('marks the connection as reconnecting and rejoins on the next connect', async () => {
    await mount();
    act(() => socket.fire('disconnect'));
    expect(useTrucoStore.getState().connection).toBe('reconnecting');
    await act(async () => {
      socket.fire('connect');
      await flush();
    });
    expect(socket.emitted.filter((e) => e.event === 'truco:join')).toHaveLength(2);
    expect(useTrucoStore.getState().connection).toBe('online');
  });

  it.each([
    ['NOT_FOUND', 'not_found'],
    ['ROOM_FULL', 'full'],
    ['GAME_IN_PROGRESS', 'in_progress'],
    ['INVALID_STATE', 'error'],
  ])('maps a %s join error to an exit screen', async (code, reason) => {
    await mount({ ok: false, error: { code, message: 'x' } });
    expect(useTrucoStore.getState().exit).toEqual({ reason, message: 'x' });
  });

  it('expires the session on an auth error', async () => {
    await mount();
    act(() => socket.fire('connect_error', new Error('UNAUTHENTICATED')));
    expect(useTrucoStore.getState().exit!.reason).toBe('error');
  });

  it('sends game actions with a fresh actionId and reports failures', async () => {
    const { hook, l } = await mount();
    socket.acks.set('truco:play_card', { ok: false, error: { code: 'NOT_YOUR_TURN', message: 'Não é a sua vez' } });
    await act(async () => {
      await hook.result.current.playCard('h1s0c0');
    });
    socket.acks.set('truco:respond_bet', { ok: true, data: null });
    await act(async () => {
      await hook.result.current.respondBet('accept');
      await hook.result.current.respondBet('accept');
    });
    const plays = socket.emitted.filter((e) => e.event === 'truco:play_card');
    expect(plays[0].payload).toMatchObject({ cardId: 'h1s0c0', actionId: expect.any(String) });
    const ids = socket.emitted.filter((e) => e.event === 'truco:respond_bet').map((e) => (e.payload as { actionId: string }).actionId);
    expect(new Set(ids).size).toBe(2);
    expect(toastError).toHaveBeenCalledWith('Não é a sua vez');
    expect(l.onError).toHaveBeenCalledTimes(1);
  });

  it('leaves the table and disconnects on unmount', async () => {
    const { hook } = await mount();
    socket.acks.set('truco:leave', { ok: true, data: null });
    await act(async () => {
      await hook.result.current.leave();
    });
    expect(useTrucoStore.getState().exit!.reason).toBe('left');
    hook.unmount();
    expect(socket.connected).toBe(false);
    expect(socket.listenerCount('truco:state')).toBe(0);
  });
});

describe('createTable', () => {
  it('connects and creates a table', async () => {
    socket.acks.set('truco:create', { ok: true, data: snapshot });
    const pending = createTable();
    socket.fire('connect');
    await expect(pending).resolves.toEqual({ ok: true, data: snapshot });
  });

  it('reports when the server cannot be reached', async () => {
    socket.connected = false;
    socket.removeAllListeners();
    const pending = createTable();
    socket.fire('connect_error', new Error('down'));
    await expect(pending).resolves.toMatchObject({ ok: false });
  });
});

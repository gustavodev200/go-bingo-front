'use client';

import { useEffect, useMemo, useRef } from 'react';
import type { Socket } from 'socket.io-client';
import { toast } from 'sonner';
import {
  TRUCO_NAMESPACE,
  TrucoServerEvents,
  type Ack,
  type ErrorCode,
  type Seat,
  type TrucoBetResponse,
  type TrucoClientAckData,
  type TrucoGesture,
  type TrucoServerEventPayloads,
  type TrucoSnapshot,
} from '@/contracts';
import { createSocket } from '@/lib/socket';
import type { Announced } from './reactions';
import { useTrucoStore, type TrucoExit } from './store';

// Socket.IO listeners receive whatever the server sent; payloads are narrowed per event below.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Listener = (...args: any[]) => void;

const ACK_TIMEOUT_MS = 5_000;
const CONNECT_TIMEOUT_MS = 8_000;
const JOIN_RETRY_MS = 1_000;
const JOIN_MAX_ATTEMPTS = 5;

let shared: Socket | null = null;

/** One socket for the whole truco area: the lobby creates the table and the room keeps using it. */
export function trucoSocket(): Socket {
  shared ??= createSocket(TRUCO_NAMESPACE);
  return shared;
}

export async function emitTruco<E extends keyof TrucoClientAckData>(socket: Socket, event: E, payload: object = {}): Promise<Ack<TrucoClientAckData[E]>> {
  try {
    return (await socket.timeout(ACK_TIMEOUT_MS).emitWithAck(event, payload)) as Ack<TrucoClientAckData[E]>;
  } catch {
    return { ok: false, error: { code: 'INTERNAL', message: 'Sem resposta do servidor' } };
  }
}

function connected(socket: Socket): Promise<boolean> {
  if (socket.connected) return Promise.resolve(true);
  return new Promise((resolve) => {
    const done = (ok: boolean) => {
      clearTimeout(timer);
      socket.off('connect', onConnect);
      socket.off('connect_error', onError);
      resolve(ok);
    };
    const onConnect = () => done(true);
    const onError = () => done(false);
    const timer = setTimeout(() => done(false), CONNECT_TIMEOUT_MS);
    socket.on('connect', onConnect);
    socket.on('connect_error', onError);
    socket.connect();
  });
}

/** Opens a new table with the player at seat 0. */
export async function createTable(): Promise<Ack<TrucoSnapshot>> {
  const socket = trucoSocket();
  if (!(await connected(socket))) return { ok: false, error: { code: 'INTERNAL', message: 'Sem conexão com o servidor' } };
  return emitTruco(socket, 'truco:create');
}

const EXIT_BY_CODE: Partial<Record<ErrorCode, TrucoExit['reason']>> = {
  NOT_FOUND: 'not_found',
  ROOM_FULL: 'full',
  GAME_IN_PROGRESS: 'in_progress',
};

export interface TrucoActions {
  leave(): Promise<boolean>;
  ready(ready: boolean): Promise<boolean>;
  takeSeat(seat: Seat): Promise<boolean>;
  start(): Promise<boolean>;
  rematch(): Promise<boolean>;
  playCard(cardId: string): Promise<boolean>;
  requestBet(): Promise<boolean>;
  respondBet(response: TrucoBetResponse): Promise<boolean>;
  decideTen(play: boolean): Promise<boolean>;
  signal(gesture: TrucoGesture): Promise<boolean>;
}

export interface TrucoListeners {
  /** A validated announcement seen for the first time (duplicates are dropped by seq). */
  onAnnouncement(msg: Announced): void;
  onSignal(payload: TrucoServerEventPayloads['truco:signal_received']): void;
  onGesture(payload: TrucoServerEventPayloads['truco:gestured']): void;
  onError(): void;
}

const newActionId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

/**
 * Joins the table `code` and keeps the store in sync. On every (re)connection it
 * joins again, which the server treats as a reconnection to the same seat.
 */
export function useTrucoRoom(code: string, listeners: TrucoListeners): TrucoActions {
  const listenersRef = useRef(listeners);
  useEffect(() => {
    listenersRef.current = listeners;
  }, [listeners]);

  useEffect(() => {
    let active = true;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    // Events that arrive before the join ack are replayed on top of the snapshot.
    let joining = true;
    let pending: { event: string; payload: unknown }[] = [];
    const store = useTrucoStore.getState();
    store.reset();
    const socket = trucoSocket();
    const bound: [string, Listener][] = [];
    const on = (event: string, fn: Listener) => {
      socket.on(event, fn);
      bound.push([event, fn]);
    };

    const handle = (event: string, payload: unknown) => {
      const s = useTrucoStore.getState();
      switch (event) {
        case TrucoServerEvents.STATE:
          return s.applyState(payload as TrucoServerEventPayloads['truco:state']);
        case TrucoServerEvents.PRIVATE_HAND:
          return s.applyHand(payload as TrucoServerEventPayloads['truco:private_hand']);
        case TrucoServerEvents.SIGNAL_RECEIVED:
          return listenersRef.current.onSignal(payload as TrucoServerEventPayloads['truco:signal_received']);
        case TrucoServerEvents.GESTURED:
          return listenersRef.current.onGesture(payload as TrucoServerEventPayloads['truco:gestured']);
        case TrucoServerEvents.ROOM_CLOSED:
          return s.setExit({ reason: 'not_found', message: 'A mesa foi encerrada' });
        default: {
          const seq = (payload as { seq?: unknown }).seq;
          if (typeof seq === 'number' && s.accept(seq)) listenersRef.current.onAnnouncement({ event, payload } as Announced);
        }
      }
    };

    for (const event of Object.values(TrucoServerEvents))
      on(event, (payload: unknown) => {
        if (joining) pending.push({ event, payload });
        else handle(event, payload);
      });

    function join(attempt: number) {
      void emitTruco(socket, 'truco:join', { code }).then((res) => {
        if (!active || useTrucoStore.getState().exit) return;
        const s = useTrucoStore.getState();
        if (res.ok) {
          s.applySnapshot(res.data);
          joining = false;
          const queued = pending;
          pending = [];
          queued.forEach((m) => handle(m.event, m.payload));
          s.setConnection('online');
        } else if (res.error.code === 'INTERNAL' && attempt < JOIN_MAX_ATTEMPTS) {
          s.setConnection('reconnecting');
          retryTimer = setTimeout(() => join(attempt + 1), JOIN_RETRY_MS);
        } else {
          pending = [];
          s.setExit({ reason: EXIT_BY_CODE[res.error.code] ?? 'error', message: res.error.message });
        }
      });
    }

    on('connect', () => {
      if (useTrucoStore.getState().exit) return;
      joining = true;
      pending = [];
      clearTimeout(retryTimer);
      join(1);
    });
    on('disconnect', () => useTrucoStore.getState().setConnection('reconnecting'));
    on('connect_error', (error: Error) => {
      if (error.message === 'UNAUTHENTICATED') useTrucoStore.getState().setExit({ reason: 'error', message: 'Sua sessão expirou. Entre de novo.' });
      else useTrucoStore.getState().setConnection('reconnecting');
    });

    if (socket.connected) join(1);
    else socket.connect();

    return () => {
      active = false;
      clearTimeout(retryTimer);
      for (const [event, fn] of bound) socket.off(event, fn);
      // Leaving the page drops the connection; the seat stays reserved for the reconnection window.
      socket.disconnect();
    };
  }, [code]);

  return useMemo<TrucoActions>(() => {
    const call = async <E extends keyof TrucoClientAckData>(event: E, payload: object = {}): Promise<boolean> => {
      const res = await emitTruco(trucoSocket(), event, payload);
      if (!res.ok) {
        toast.error(res.error.message);
        listenersRef.current.onError();
      }
      return res.ok;
    };
    return {
      leave: async () => {
        const ok = await call('truco:leave');
        if (ok) useTrucoStore.getState().setExit({ reason: 'left', message: 'Você saiu da mesa' });
        return ok;
      },
      ready: (ready) => call('truco:ready', { ready }),
      takeSeat: (seat) => call('truco:take_seat', { seat }),
      start: () => call('truco:start'),
      rematch: () => call('truco:rematch'),
      playCard: (cardId) => call('truco:play_card', { actionId: newActionId(), cardId }),
      requestBet: () => call('truco:request_bet', { actionId: newActionId() }),
      respondBet: (response) => call('truco:respond_bet', { actionId: newActionId(), response }),
      decideTen: (play) => call('truco:ten_decision', { actionId: newActionId(), play }),
      signal: (gesture) => call('truco:signal', { gesture }),
    };
  }, []);
}

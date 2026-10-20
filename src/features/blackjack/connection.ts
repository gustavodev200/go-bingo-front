'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { toast } from 'sonner';
import {
  BJ_NAMESPACE,
  BjServerEvents,
  type Ack,
  type BjAction,
  type ErrorCode,
  type BjClientAckData,
  type BjEmote,
  type BjRules,
  type BjPublicRoom,
  type BjServerEventPayloads,
  type BjSnapshot,
} from '@/contracts';
import { createSocket } from '@/lib/socket';
import type { Announced } from './reactions';
import { useBjStore, type BjExit } from './store';

// Socket.IO listeners receive whatever the server sent; payloads are narrowed per event below.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Listener = (...args: any[]) => void;

const ACK_TIMEOUT_MS = 5_000;
const CONNECT_TIMEOUT_MS = 8_000;
const JOIN_RETRY_MS = 1_000;
const JOIN_MAX_ATTEMPTS = 5;

let shared: Socket | null = null;

/** One socket for the whole blackjack area: the lobby creates the table and the room keeps using it. */
export function bjSocket(): Socket {
  shared ??= createSocket(BJ_NAMESPACE);
  return shared;
}

export async function emitBj<E extends keyof BjClientAckData>(socket: Socket, event: E, payload: object = {}): Promise<Ack<BjClientAckData[E]>> {
  try {
    return (await socket.timeout(ACK_TIMEOUT_MS).emitWithAck(event, payload)) as Ack<BjClientAckData[E]>;
  } catch {
    return {
      ok: false,
      error: { code: 'INTERNAL', message: 'Sem resposta do servidor' },
    };
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
export async function createBjTable(isPublic: boolean): Promise<Ack<BjSnapshot>> {
  const socket = bjSocket();
  if (!(await connected(socket)))
    return {
      ok: false,
      error: { code: 'INTERNAL', message: 'Sem conexão com o servidor' },
    };
  return emitBj(socket, 'blackjack:create', { isPublic });
}

/**
 * Public tables still taking players, kept live while mounted (null while loading).
 * Reconnections watch again, so the list never goes stale.
 */
export function usePublicBjTables(): BjPublicRoom[] | null {
  const [rooms, setRooms] = useState<BjPublicRoom[] | null>(null);
  useEffect(() => {
    const socket = bjSocket();
    let active = true;
    const watch = () =>
      void emitBj(socket, 'blackjack:watch_rooms').then((res) => {
        if (active && res.ok) setRooms(res.data);
      });
    const onUpdate = ({ rooms: next }: { rooms: BjPublicRoom[] }) => setRooms(next);
    socket.on(BjServerEvents.ROOMS_UPDATED, onUpdate);
    socket.on('connect', watch);
    if (socket.connected) watch();
    else socket.connect();
    return () => {
      active = false;
      socket.off(BjServerEvents.ROOMS_UPDATED, onUpdate);
      socket.off('connect', watch);
      if (socket.connected) void emitBj(socket, 'blackjack:unwatch_rooms');
    };
  }, []);
  return rooms;
}

const EXIT_BY_CODE: Partial<Record<ErrorCode, BjExit['reason']>> = {
  NOT_FOUND: 'not_found',
  ROOM_FULL: 'full',
  GAME_IN_PROGRESS: 'in_progress',
};

export interface BjActions {
  leave(): Promise<boolean>;
  ready(ready: boolean): Promise<boolean>;
  setRules(rules: BjRules): Promise<boolean>;
  setVisibility(isPublic: boolean): Promise<boolean>;
  setStake(stake: number): Promise<boolean>;
  start(): Promise<boolean>;
  rematch(): Promise<boolean>;
  bet(amount: number): Promise<boolean>;
  insurance(take: boolean): Promise<boolean>;
  act(action: BjAction): Promise<boolean>;
  emote(emote: BjEmote): Promise<boolean>;
}

export interface BjListeners {
  /** A validated announcement seen for the first time (duplicates are dropped by seq). */
  onAnnouncement(msg: Announced): void;
  onEmote(payload: BjServerEventPayloads['blackjack:emoted']): void;
  onError(): void;
}

const newActionId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

/**
 * Joins the table `code` and keeps the store in sync. On every (re)connection it
 * joins again, which the server treats as a reconnection to the same seat.
 */
export function useBjRoom(code: string, listeners: BjListeners): BjActions {
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
    const store = useBjStore.getState();
    store.reset();
    const socket = bjSocket();
    const bound: [string, Listener][] = [];
    const on = (event: string, fn: Listener) => {
      socket.on(event, fn);
      bound.push([event, fn]);
    };

    const handle = (event: string, payload: unknown) => {
      const s = useBjStore.getState();
      switch (event) {
        case BjServerEvents.STATE:
          return s.applyState(payload as BjServerEventPayloads['blackjack:state']);
        case BjServerEvents.EMOTED:
          return listenersRef.current.onEmote(payload as BjServerEventPayloads['blackjack:emoted']);
        case BjServerEvents.ROOM_CLOSED:
          return s.setExit({
            reason: 'not_found',
            message: 'A mesa foi encerrada',
          });
        default: {
          const seq = (payload as { seq?: unknown }).seq;
          if (typeof seq === 'number' && s.accept(seq))
            listenersRef.current.onAnnouncement({
              event,
              payload,
            } as Announced);
        }
      }
    };

    for (const event of Object.values(BjServerEvents))
      on(event, (payload: unknown) => {
        if (joining) pending.push({ event, payload });
        else handle(event, payload);
      });

    function join(attempt: number) {
      void emitBj(socket, 'blackjack:join', { code }).then((res) => {
        if (!active || useBjStore.getState().exit) return;
        const s = useBjStore.getState();
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
          s.setExit({
            reason: EXIT_BY_CODE[res.error.code] ?? 'error',
            message: res.error.message,
          });
        }
      });
    }

    on('connect', () => {
      if (useBjStore.getState().exit) return;
      joining = true;
      pending = [];
      clearTimeout(retryTimer);
      join(1);
    });
    on('disconnect', () => useBjStore.getState().setConnection('reconnecting'));
    on('connect_error', (error: Error) => {
      if (error.message === 'UNAUTHENTICATED')
        useBjStore.getState().setExit({
          reason: 'error',
          message: 'Sua sessão expirou. Entre de novo.',
        });
      else useBjStore.getState().setConnection('reconnecting');
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

  return useMemo<BjActions>(() => {
    const call = async <E extends keyof BjClientAckData>(event: E, payload: object = {}): Promise<boolean> => {
      const res = await emitBj(bjSocket(), event, payload);
      if (!res.ok) {
        toast.error(res.error.message);
        listenersRef.current.onError();
      }
      return res.ok;
    };
    return {
      leave: async () => {
        const ok = await call('blackjack:leave');
        if (ok) useBjStore.getState().setExit({ reason: 'left', message: 'Você saiu da mesa' });
        return ok;
      },
      ready: (ready) => call('blackjack:ready', { ready }),
      setRules: (rules) => call('blackjack:set_rules', { rules }),
      setVisibility: (isPublic) => call('blackjack:set_visibility', { isPublic }),
      setStake: (stake) => call('blackjack:set_stake', { stake }),
      start: () => call('blackjack:start'),
      rematch: () => call('blackjack:rematch'),
      bet: (amount) => call('blackjack:bet', { actionId: newActionId(), amount }),
      insurance: (take) => call('blackjack:insurance', { actionId: newActionId(), take }),
      act: (action) => call('blackjack:act', { actionId: newActionId(), action }),
      emote: (emote) => call('blackjack:emote', { emote }),
    };
  }, []);
}

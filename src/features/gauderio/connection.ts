'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { toast } from 'sonner';
import {
  GAUD_NAMESPACE,
  GaudServerEvents,
  type Ack,
  type ErrorCode,
  type GaudCall,
  type GaudClientAckData,
  type GaudSeat,
  type GaudSettings,
  type GaudPublicRoom,
  type GaudServerEventPayloads,
  type GaudSnapshot,
} from '@/contracts';
import { createSocket } from '@/lib/socket';
import type { Announced } from './reactions';
import { useGaudStore, type GaudExit } from './store';

// Socket.IO listeners receive whatever the server sent; payloads are narrowed per event below.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Listener = (...args: any[]) => void;

const ACK_TIMEOUT_MS = 5_000;
const CONNECT_TIMEOUT_MS = 8_000;
const JOIN_RETRY_MS = 1_000;
const JOIN_MAX_ATTEMPTS = 5;

let shared: Socket | null = null;

/** One socket for the whole gauderio area: the lobby creates the table and the room keeps using it. */
export function gaudSocket(): Socket {
  shared ??= createSocket(GAUD_NAMESPACE);
  return shared;
}

export async function emitGaud<E extends keyof GaudClientAckData>(socket: Socket, event: E, payload: object = {}): Promise<Ack<GaudClientAckData[E]>> {
  try {
    return (await socket.timeout(ACK_TIMEOUT_MS).emitWithAck(event, payload)) as Ack<GaudClientAckData[E]>;
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
export async function createTable(isPublic: boolean, settings: GaudSettings): Promise<Ack<GaudSnapshot>> {
  const socket = gaudSocket();
  if (!(await connected(socket))) return { ok: false, error: { code: 'INTERNAL', message: 'Sem conexão com o servidor' } };
  return emitGaud(socket, 'gauderio:create', { isPublic, settings });
}

/**
 * Public tables still taking players, kept live while mounted (null while loading).
 * Reconnections watch again, so the list never goes stale.
 */
export function usePublicTables(): GaudPublicRoom[] | null {
  const [rooms, setRooms] = useState<GaudPublicRoom[] | null>(null);
  useEffect(() => {
    const socket = gaudSocket();
    let active = true;
    const watch = () =>
      void emitGaud(socket, 'gauderio:watch_rooms').then((res) => {
        if (active && res.ok) setRooms(res.data);
      });
    const onUpdate = ({ rooms: next }: { rooms: GaudPublicRoom[] }) => setRooms(next);
    socket.on(GaudServerEvents.ROOMS_UPDATED, onUpdate);
    socket.on('connect', watch);
    if (socket.connected) watch();
    else socket.connect();
    return () => {
      active = false;
      socket.off(GaudServerEvents.ROOMS_UPDATED, onUpdate);
      socket.off('connect', watch);
      if (socket.connected) void emitGaud(socket, 'gauderio:unwatch_rooms');
    };
  }, []);
  return rooms;
}

const EXIT_BY_CODE: Partial<Record<ErrorCode, GaudExit['reason']>> = {
  NOT_FOUND: 'not_found',
  ROOM_FULL: 'full',
  GAME_IN_PROGRESS: 'in_progress',
};

export interface GaudActionsApi {
  leave(): Promise<boolean>;
  ready(ready: boolean): Promise<boolean>;
  takeSeat(seat: GaudSeat): Promise<boolean>;
  setVisibility(isPublic: boolean): Promise<boolean>;
  setStake(stake: number): Promise<boolean>;
  setSettings(settings: GaudSettings): Promise<boolean>;
  start(): Promise<boolean>;
  rematch(): Promise<boolean>;
  playCard(cardId: string, hidden?: boolean): Promise<boolean>;
  call(call: GaudCall): Promise<boolean>;
  respond(accept: boolean): Promise<boolean>;
  fold(): Promise<boolean>;
}

export interface GaudListeners {
  /** A validated announcement seen for the first time (duplicates are dropped by seq). */
  onAnnouncement(msg: Announced): void;
  onError(): void;
}

const newActionId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

/**
 * Joins the table `code` and keeps the store in sync. On every (re)connection it
 * joins again, which the server treats as a reconnection to the same seat.
 */
export function useGaudRoom(code: string, listeners: GaudListeners): GaudActionsApi {
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
    const store = useGaudStore.getState();
    store.reset();
    const socket = gaudSocket();
    const bound: [string, Listener][] = [];
    const on = (event: string, fn: Listener) => {
      socket.on(event, fn);
      bound.push([event, fn]);
    };

    const handle = (event: string, payload: unknown) => {
      const s = useGaudStore.getState();
      switch (event) {
        case GaudServerEvents.STATE:
          return s.applyState(payload as GaudServerEventPayloads['gauderio:state']);
        case GaudServerEvents.PRIVATE_HAND:
          return s.applyHand(payload as GaudServerEventPayloads['gauderio:private_hand']);
        case GaudServerEvents.ROOM_CLOSED:
          return s.setExit({ reason: 'not_found', message: 'A mesa foi encerrada' });
        default: {
          const seq = (payload as { seq?: unknown }).seq;
          if (typeof seq === 'number' && s.accept(seq)) listenersRef.current.onAnnouncement({ event, payload } as Announced);
        }
      }
    };

    for (const event of Object.values(GaudServerEvents))
      on(event, (payload: unknown) => {
        if (joining) pending.push({ event, payload });
        else handle(event, payload);
      });

    function join(attempt: number) {
      void emitGaud(socket, 'gauderio:join', { code }).then((res) => {
        if (!active || useGaudStore.getState().exit) return;
        const s = useGaudStore.getState();
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
      if (useGaudStore.getState().exit) return;
      joining = true;
      pending = [];
      clearTimeout(retryTimer);
      join(1);
    });
    on('disconnect', () => useGaudStore.getState().setConnection('reconnecting'));
    on('connect_error', (error: Error) => {
      if (error.message === 'UNAUTHENTICATED') useGaudStore.getState().setExit({ reason: 'error', message: 'Sua sessão expirou. Entre de novo.' });
      else useGaudStore.getState().setConnection('reconnecting');
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

  return useMemo<GaudActionsApi>(() => {
    const call = async <E extends keyof GaudClientAckData>(event: E, payload: object = {}): Promise<boolean> => {
      const res = await emitGaud(gaudSocket(), event, payload);
      if (!res.ok) {
        toast.error(res.error.message);
        listenersRef.current.onError();
      }
      return res.ok;
    };
    return {
      leave: async () => {
        const ok = await call('gauderio:leave');
        if (ok) useGaudStore.getState().setExit({ reason: 'left', message: 'Você saiu da mesa' });
        return ok;
      },
      ready: (ready) => call('gauderio:ready', { ready }),
      takeSeat: (seat) => call('gauderio:take_seat', { seat }),
      setVisibility: (isPublic) => call('gauderio:set_visibility', { isPublic }),
      setStake: (stake) => call('gauderio:set_stake', { stake }),
      setSettings: (settings) => call('gauderio:set_settings', { settings }),
      start: () => call('gauderio:start'),
      rematch: () => call('gauderio:rematch'),
      playCard: (cardId, hidden = false) => call('gauderio:play_card', { actionId: newActionId(), cardId, hidden }),
      call: (c) => call('gauderio:call', { actionId: newActionId(), call: c }),
      respond: (accept) => call('gauderio:respond', { actionId: newActionId(), accept }),
      fold: () => call('gauderio:fold', { actionId: newActionId() }),
    };
  }, []);
}

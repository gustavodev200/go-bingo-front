'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { toast } from 'sonner';
import {
  BOMBER_NAMESPACE,
  BomberClientEvents,
  BomberServerEvents,
  type Ack,
  type BomberClientAckData,
  type BomberFrame,
  type BomberPublicRoom,
  type BomberRules,
  type BomberServerEventName,
  type BomberServerEventPayloads,
  type BomberSnapshot,
  type ErrorCode,
} from '@/contracts';
import { createSocket } from '@/lib/socket';
import { useBomberStore, type BomberExit } from './store';
import type { TickInput } from './input';

// Socket.IO listeners receive whatever the server sent; payloads are narrowed per event below.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Listener = (...args: any[]) => void;

const ACK_TIMEOUT_MS = 5_000;
const CONNECT_TIMEOUT_MS = 8_000;
const JOIN_RETRY_MS = 1_000;
const JOIN_MAX_ATTEMPTS = 5;

let shared: Socket | null = null;

/** One socket for the whole Bomberman area: the lobby creates the room and the room keeps using it. */
export function bomberSocket(): Socket {
  shared ??= createSocket(BOMBER_NAMESPACE);
  return shared;
}

export async function emitBomber<E extends keyof BomberClientAckData>(socket: Socket, event: E, payload: object = {}): Promise<Ack<BomberClientAckData[E]>> {
  try {
    return (await socket.timeout(ACK_TIMEOUT_MS).emitWithAck(event, payload)) as Ack<BomberClientAckData[E]>;
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

/** Opens a new room with the player at seat 0. */
export async function createBomberRoom(isPublic: boolean): Promise<Ack<BomberSnapshot>> {
  const socket = bomberSocket();
  if (!(await connected(socket))) return { ok: false, error: { code: 'INTERNAL', message: 'Sem conexão com o servidor' } };
  return emitBomber(socket, 'bomber:create', { isPublic });
}

/** Public rooms still taking players, kept live while mounted (null while loading). */
export function usePublicBomberRooms(): BomberPublicRoom[] | null {
  const [rooms, setRooms] = useState<BomberPublicRoom[] | null>(null);
  useEffect(() => {
    const socket = bomberSocket();
    let active = true;
    const watch = () =>
      void emitBomber(socket, 'bomber:watch_rooms').then((res) => {
        if (active && res.ok) setRooms(res.data);
      });
    const onUpdate = ({ rooms: next }: { rooms: BomberPublicRoom[] }) => setRooms(next);
    socket.on(BomberServerEvents.ROOMS_UPDATED, onUpdate);
    socket.on('connect', watch);
    if (socket.connected) watch();
    else socket.connect();
    return () => {
      active = false;
      socket.off(BomberServerEvents.ROOMS_UPDATED, onUpdate);
      socket.off('connect', watch);
      if (socket.connected) void emitBomber(socket, 'bomber:unwatch_rooms');
    };
  }, []);
  return rooms;
}

const EXIT_BY_CODE: Partial<Record<ErrorCode, BomberExit['reason']>> = {
  NOT_FOUND: 'not_found',
  ROOM_FULL: 'full',
  GAME_IN_PROGRESS: 'in_progress',
};

export interface BomberActions {
  leave(): Promise<boolean>;
  ready(ready: boolean): Promise<boolean>;
  setRules(rules: BomberRules): Promise<boolean>;
  setVisibility(isPublic: boolean): Promise<boolean>;
  setStake(stake: number): Promise<boolean>;
  setColor(color: number): Promise<boolean>;
  addBot(): Promise<boolean>;
  removeBot(seat: number): Promise<boolean>;
  start(): Promise<boolean>;
  rematch(): Promise<boolean>;
  /** Fire-and-forget input of one client tick. */
  input(seq: number, input: TickInput): void;
}

export type BomberAnnouncement = {
  [E in BomberServerEventName]: { event: E; payload: BomberServerEventPayloads[E] };
}[BomberServerEventName];

export interface BomberListeners {
  /** A validated announcement seen for the first time (duplicates are dropped by seq). */
  onAnnouncement(msg: BomberAnnouncement): void;
  /** Every arena frame, as it arrives (also the one in the join snapshot). */
  onFrame(frame: BomberFrame): void;
}

/**
 * Joins room `code` and keeps the store in sync. On every (re)connection it
 * joins again, which the server treats as a reconnection to the same seat.
 */
export function useBomberRoom(code: string, listeners: BomberListeners): BomberActions {
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
    useBomberStore.getState().reset();
    const socket = bomberSocket();
    const bound: [string, Listener][] = [];
    const on = (event: string, fn: Listener) => {
      socket.on(event, fn);
      bound.push([event, fn]);
    };

    const handle = (event: string, payload: unknown) => {
      const s = useBomberStore.getState();
      switch (event) {
        case BomberServerEvents.STATE:
          return s.applyState(payload as BomberRoomStatePayload);
        case BomberServerEvents.FRAME:
          return listenersRef.current.onFrame(payload as BomberFrame);
        case BomberServerEvents.ROOM_CLOSED:
          return s.setExit({ reason: 'not_found', message: 'A sala foi encerrada' });
        default: {
          const seq = (payload as { seq?: unknown }).seq;
          if (typeof seq === 'number' && s.accept(seq)) listenersRef.current.onAnnouncement({ event, payload } as BomberAnnouncement);
        }
      }
    };

    for (const event of Object.values(BomberServerEvents))
      on(event, (payload: unknown) => {
        if (joining) pending.push({ event, payload });
        else handle(event, payload);
      });

    function join(attempt: number) {
      void emitBomber(socket, 'bomber:join', { code }).then((res) => {
        if (!active || useBomberStore.getState().exit) return;
        const s = useBomberStore.getState();
        if (res.ok) {
          s.applySnapshot(res.data);
          if (res.data.frame) listenersRef.current.onFrame(res.data.frame);
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
      if (useBomberStore.getState().exit) return;
      joining = true;
      pending = [];
      clearTimeout(retryTimer);
      join(1);
    });
    on('disconnect', () => useBomberStore.getState().setConnection('reconnecting'));
    on('connect_error', (error: Error) => {
      if (error.message === 'UNAUTHENTICATED') useBomberStore.getState().setExit({ reason: 'error', message: 'Sua sessão expirou. Entre de novo.' });
      else useBomberStore.getState().setConnection('reconnecting');
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

  return useMemo<BomberActions>(() => {
    const call = async <E extends keyof BomberClientAckData>(event: E, payload: object = {}): Promise<boolean> => {
      const res = await emitBomber(bomberSocket(), event, payload);
      if (!res.ok) toast.error(res.error.message);
      return res.ok;
    };
    return {
      leave: async () => {
        const ok = await call('bomber:leave');
        if (ok) useBomberStore.getState().setExit({ reason: 'left', message: 'Você saiu da sala' });
        return ok;
      },
      ready: (ready) => call('bomber:ready', { ready }),
      setRules: (rules) => call('bomber:set_rules', { rules }),
      setVisibility: (isPublic) => call('bomber:set_visibility', { isPublic }),
      setStake: (stake) => call('bomber:set_stake', { stake }),
      setColor: (color) => call('bomber:set_color', { color }),
      addBot: () => call('bomber:add_bot'),
      removeBot: (seat) => call('bomber:remove_bot', { seat }),
      start: () => call('bomber:start'),
      rematch: () => call('bomber:rematch'),
      input: (s, { d, b, a }) => {
        const socket = bomberSocket();
        if (socket.connected) socket.emit(BomberClientEvents.INPUT, { s, d, b, a });
      },
    };
  }, []);
}

type BomberRoomStatePayload = BomberServerEventPayloads['bomber:state'];

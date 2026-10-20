'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { toast } from 'sonner';
import {
  TACADA_NAMESPACE,
  TacadaServerEvents,
  type Ack,
  type ErrorCode,
  type TacadaClientAckData,
  type TacadaAim,
  type TacadaEmote,
  type TacadaRules,
  type TacadaPublicRoom,
  type TacadaServerEventPayloads,
  type TacadaSnapshot,
} from '@/contracts';
import { createSocket } from '@/lib/socket';
import type { Announced } from './reactions';
import { setRemoteAim } from './live-aim';
import { useTacadaStore, type TacadaExit } from './store';

// Socket.IO listeners receive whatever the server sent; payloads are narrowed per event below.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Listener = (...args: any[]) => void;

const ACK_TIMEOUT_MS = 5_000;
const CONNECT_TIMEOUT_MS = 8_000;
const JOIN_RETRY_MS = 1_000;
const JOIN_MAX_ATTEMPTS = 5;

let shared: Socket | null = null;

/** One socket for the whole Tacada area: the lobby creates the table and the room keeps using it. */
export function tacadaSocket(): Socket {
  shared ??= createSocket(TACADA_NAMESPACE);
  return shared;
}

export async function emitTacada<E extends keyof TacadaClientAckData>(socket: Socket, event: E, payload: object = {}): Promise<Ack<TacadaClientAckData[E]>> {
  try {
    return (await socket.timeout(ACK_TIMEOUT_MS).emitWithAck(event, payload)) as Ack<TacadaClientAckData[E]>;
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
export async function createTacadaTable(isPublic: boolean): Promise<Ack<TacadaSnapshot>> {
  const socket = tacadaSocket();
  if (!(await connected(socket)))
    return {
      ok: false,
      error: { code: 'INTERNAL', message: 'Sem conexão com o servidor' },
    };
  return emitTacada(socket, 'tacada:create', { isPublic });
}

/**
 * Public tables still taking players, kept live while mounted (null while loading).
 * Reconnections watch again, so the list never goes stale.
 */
export function usePublicTacadaTables(): TacadaPublicRoom[] | null {
  const [rooms, setRooms] = useState<TacadaPublicRoom[] | null>(null);
  useEffect(() => {
    const socket = tacadaSocket();
    let active = true;
    const watch = () =>
      void emitTacada(socket, 'tacada:watch_rooms').then((res) => {
        if (active && res.ok) setRooms(res.data);
      });
    const onUpdate = ({ rooms: next }: { rooms: TacadaPublicRoom[] }) => setRooms(next);
    socket.on(TacadaServerEvents.ROOMS_UPDATED, onUpdate);
    socket.on('connect', watch);
    if (socket.connected) watch();
    else socket.connect();
    return () => {
      active = false;
      socket.off(TacadaServerEvents.ROOMS_UPDATED, onUpdate);
      socket.off('connect', watch);
      if (socket.connected) void emitTacada(socket, 'tacada:unwatch_rooms');
    };
  }, []);
  return rooms;
}

const EXIT_BY_CODE: Partial<Record<ErrorCode, TacadaExit['reason']>> = {
  NOT_FOUND: 'not_found',
  ROOM_FULL: 'full',
  GAME_IN_PROGRESS: 'in_progress',
};

export interface TacadaShootInput {
  dirX: number;
  dirY: number;
  power: number;
  spinX: number;
  spinY: number;
  cueX?: number;
  cueY?: number;
  pocket?: number;
}

export interface TacadaActions {
  leave(): Promise<boolean>;
  ready(ready: boolean): Promise<boolean>;
  setRules(rules: TacadaRules): Promise<boolean>;
  setVisibility(isPublic: boolean): Promise<boolean>;
  setStake(stake: number): Promise<boolean>;
  start(): Promise<boolean>;
  rematch(): Promise<boolean>;
  shoot(shot: TacadaShootInput): Promise<boolean>;
  /** Live aim for the other screen: fire and forget, never acknowledged. */
  aim(aim: Omit<TacadaAim, 'seat'>): void;
  resign(): Promise<boolean>;
  emote(emote: TacadaEmote): Promise<boolean>;
}

export interface TacadaListeners {
  /** A validated announcement seen for the first time (duplicates are dropped by seq). */
  onAnnouncement(msg: Announced): void;
  onEmote(payload: TacadaServerEventPayloads['tacada:emoted']): void;
  onError(): void;
}

const newActionId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

/**
 * Joins the table `code` and keeps the store in sync. On every (re)connection it
 * joins again, which the server treats as a reconnection to the same seat.
 */
export function useTacadaRoom(code: string, listeners: TacadaListeners): TacadaActions {
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
    const store = useTacadaStore.getState();
    store.reset();
    const socket = tacadaSocket();
    const bound: [string, Listener][] = [];
    const on = (event: string, fn: Listener) => {
      socket.on(event, fn);
      bound.push([event, fn]);
    };

    const handle = (event: string, payload: unknown) => {
      const s = useTacadaStore.getState();
      switch (event) {
        case TacadaServerEvents.STATE:
          return s.applyState(payload as TacadaServerEventPayloads['tacada:state']);
        case TacadaServerEvents.AIMED:
          return setRemoteAim(payload as TacadaServerEventPayloads['tacada:aimed']);
        case TacadaServerEvents.EMOTED:
          return listenersRef.current.onEmote(payload as TacadaServerEventPayloads['tacada:emoted']);
        case TacadaServerEvents.ROOM_CLOSED:
          return s.setExit({
            reason: 'not_found',
            message: 'A mesa foi encerrada',
          });
        default: {
          const seq = (payload as { seq?: unknown }).seq;
          if (typeof seq !== 'number' || !s.accept(seq)) return;
          if (event === TacadaServerEvents.SHOT) s.queueShot(payload as TacadaServerEventPayloads['tacada:shot']);
          listenersRef.current.onAnnouncement({
            event,
            payload,
          } as Announced);
        }
      }
    };

    for (const event of Object.values(TacadaServerEvents))
      on(event, (payload: unknown) => {
        // Aim is volatile and only matters live: never queued behind the join.
        if (event === TacadaServerEvents.AIMED) return joining ? undefined : handle(event, payload);
        if (joining) pending.push({ event, payload });
        else handle(event, payload);
      });

    function join(attempt: number) {
      void emitTacada(socket, 'tacada:join', { code }).then((res) => {
        if (!active || useTacadaStore.getState().exit) return;
        const s = useTacadaStore.getState();
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
      if (useTacadaStore.getState().exit) return;
      joining = true;
      pending = [];
      clearTimeout(retryTimer);
      join(1);
    });
    on('disconnect', () => useTacadaStore.getState().setConnection('reconnecting'));
    on('connect_error', (error: Error) => {
      if (error.message === 'UNAUTHENTICATED')
        useTacadaStore.getState().setExit({
          reason: 'error',
          message: 'Sua sessão expirou. Entre de novo.',
        });
      else useTacadaStore.getState().setConnection('reconnecting');
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

  return useMemo<TacadaActions>(() => {
    const call = async <E extends keyof TacadaClientAckData>(event: E, payload: object = {}): Promise<boolean> => {
      const res = await emitTacada(tacadaSocket(), event, payload);
      if (!res.ok) {
        toast.error(res.error.message);
        listenersRef.current.onError();
      }
      return res.ok;
    };
    return {
      leave: async () => {
        const ok = await call('tacada:leave');
        if (ok) useTacadaStore.getState().setExit({ reason: 'left', message: 'Você saiu da mesa' });
        return ok;
      },
      ready: (ready) => call('tacada:ready', { ready }),
      setRules: (rules) => call('tacada:set_rules', { rules }),
      setVisibility: (isPublic) => call('tacada:set_visibility', { isPublic }),
      setStake: (stake) => call('tacada:set_stake', { stake }),
      start: () => call('tacada:start'),
      rematch: () => call('tacada:rematch'),
      shoot: (shot) => call('tacada:shoot', { actionId: newActionId(), ...shot }),
      aim: (aim) => {
        const socket = tacadaSocket();
        if (socket.connected) socket.volatile.emit('tacada:aim', aim);
      },
      resign: () => call('tacada:resign', { actionId: newActionId() }),
      emote: (emote) => call('tacada:emote', { emote }),
    };
  }, []);
}

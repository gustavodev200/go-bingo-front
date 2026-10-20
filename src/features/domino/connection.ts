'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { toast } from 'sonner';
import {
  DOMINO_NAMESPACE,
  DominoServerEvents,
  type Ack,
  type ErrorCode,
  type DominoClientAckData,
  type DominoEmote,
  type DominoRules,
  type DominoPublicRoom,
  type DominoServerEventPayloads,
  type DominoSide,
  type DominoSnapshot,
} from '@/contracts';
import { createSocket } from '@/lib/socket';
import type { Announced } from './reactions';
import { useDominoStore, type DominoExit } from './store';

// Socket.IO listeners receive whatever the server sent; payloads are narrowed per event below.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Listener = (...args: any[]) => void;

const ACK_TIMEOUT_MS = 5_000;
const CONNECT_TIMEOUT_MS = 8_000;
const JOIN_RETRY_MS = 1_000;
const JOIN_MAX_ATTEMPTS = 5;

let shared: Socket | null = null;

/** One socket for the whole dominó area: the lobby creates the table and the room keeps using it. */
export function dominoSocket(): Socket {
  shared ??= createSocket(DOMINO_NAMESPACE);
  return shared;
}

export async function emitDomino<E extends keyof DominoClientAckData>(socket: Socket, event: E, payload: object = {}): Promise<Ack<DominoClientAckData[E]>> {
  try {
    return (await socket.timeout(ACK_TIMEOUT_MS).emitWithAck(event, payload)) as Ack<DominoClientAckData[E]>;
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
export async function createDominoTable(isPublic: boolean): Promise<Ack<DominoSnapshot>> {
  const socket = dominoSocket();
  if (!(await connected(socket)))
    return {
      ok: false,
      error: { code: 'INTERNAL', message: 'Sem conexão com o servidor' },
    };
  return emitDomino(socket, 'domino:create', { isPublic });
}

/**
 * Public tables still taking players, kept live while mounted (null while loading).
 * Reconnections watch again, so the list never goes stale.
 */
export function usePublicDominoTables(): DominoPublicRoom[] | null {
  const [rooms, setRooms] = useState<DominoPublicRoom[] | null>(null);
  useEffect(() => {
    const socket = dominoSocket();
    let active = true;
    const watch = () =>
      void emitDomino(socket, 'domino:watch_rooms').then((res) => {
        if (active && res.ok) setRooms(res.data);
      });
    const onUpdate = ({ rooms: next }: { rooms: DominoPublicRoom[] }) => setRooms(next);
    socket.on(DominoServerEvents.ROOMS_UPDATED, onUpdate);
    socket.on('connect', watch);
    if (socket.connected) watch();
    else socket.connect();
    return () => {
      active = false;
      socket.off(DominoServerEvents.ROOMS_UPDATED, onUpdate);
      socket.off('connect', watch);
      if (socket.connected) void emitDomino(socket, 'domino:unwatch_rooms');
    };
  }, []);
  return rooms;
}

const EXIT_BY_CODE: Partial<Record<ErrorCode, DominoExit['reason']>> = {
  NOT_FOUND: 'not_found',
  ROOM_FULL: 'full',
  GAME_IN_PROGRESS: 'in_progress',
};

export interface DominoActions {
  leave(): Promise<boolean>;
  ready(ready: boolean): Promise<boolean>;
  /** Anfitrião, no lobby: uma CPU senta no primeiro lugar vago. */
  addBot(seat?: number): Promise<boolean>;
  removeBot(seat: number): Promise<boolean>;
  setRules(rules: DominoRules): Promise<boolean>;
  setVisibility(isPublic: boolean): Promise<boolean>;
  setStake(stake: number): Promise<boolean>;
  start(): Promise<boolean>;
  rematch(): Promise<boolean>;
  play(tileId: string, side?: DominoSide): Promise<boolean>;
  draw(): Promise<boolean>;
  emote(emote: DominoEmote): Promise<boolean>;
}

export interface DominoListeners {
  /** A validated announcement seen for the first time (duplicates are dropped by seq). */
  onAnnouncement(msg: Announced): void;
  onEmote(payload: DominoServerEventPayloads['domino:emoted']): void;
  onError(): void;
}

const newActionId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

/**
 * Joins the table `code` and keeps the store in sync. On every (re)connection it
 * joins again, which the server treats as a reconnection to the same seat.
 */
export function useDominoRoom(code: string, listeners: DominoListeners): DominoActions {
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
    const store = useDominoStore.getState();
    store.reset();
    const socket = dominoSocket();
    const bound: [string, Listener][] = [];
    const on = (event: string, fn: Listener) => {
      socket.on(event, fn);
      bound.push([event, fn]);
    };

    const handle = (event: string, payload: unknown) => {
      const s = useDominoStore.getState();
      switch (event) {
        case DominoServerEvents.STATE:
          return s.applyState(payload as DominoServerEventPayloads['domino:state']);
        case DominoServerEvents.PRIVATE_HAND:
          return s.applyHand(payload as DominoServerEventPayloads['domino:private_hand']);
        case DominoServerEvents.EMOTED:
          return listenersRef.current.onEmote(payload as DominoServerEventPayloads['domino:emoted']);
        case DominoServerEvents.ROOM_CLOSED:
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

    for (const event of Object.values(DominoServerEvents))
      on(event, (payload: unknown) => {
        if (joining) pending.push({ event, payload });
        else handle(event, payload);
      });

    function join(attempt: number) {
      void emitDomino(socket, 'domino:join', { code }).then((res) => {
        if (!active || useDominoStore.getState().exit) return;
        const s = useDominoStore.getState();
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
      if (useDominoStore.getState().exit) return;
      joining = true;
      pending = [];
      clearTimeout(retryTimer);
      join(1);
    });
    on('disconnect', () => useDominoStore.getState().setConnection('reconnecting'));
    on('connect_error', (error: Error) => {
      if (error.message === 'UNAUTHENTICATED')
        useDominoStore.getState().setExit({
          reason: 'error',
          message: 'Sua sessão expirou. Entre de novo.',
        });
      else useDominoStore.getState().setConnection('reconnecting');
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

  return useMemo<DominoActions>(() => {
    const call = async <E extends keyof DominoClientAckData>(event: E, payload: object = {}): Promise<boolean> => {
      const res = await emitDomino(dominoSocket(), event, payload);
      if (!res.ok) {
        toast.error(res.error.message);
        listenersRef.current.onError();
      }
      return res.ok;
    };
    return {
      leave: async () => {
        const ok = await call('domino:leave');
        if (ok) useDominoStore.getState().setExit({ reason: 'left', message: 'Você saiu da mesa' });
        return ok;
      },
      ready: (ready) => call('domino:ready', { ready }),
      addBot: (seat) => call('domino:add_bot', seat === undefined ? {} : { seat }),
      removeBot: (seat) => call('domino:remove_bot', { seat }),
      setRules: (rules) => call('domino:set_rules', { rules }),
      setVisibility: (isPublic) => call('domino:set_visibility', { isPublic }),
      setStake: (stake) => call('domino:set_stake', { stake }),
      start: () => call('domino:start'),
      rematch: () => call('domino:rematch'),
      play: (tileId, side) => call('domino:play', { actionId: newActionId(), tileId, ...(side ? { side } : {}) }),
      draw: () => call('domino:draw', { actionId: newActionId() }),
      emote: (emote) => call('domino:emote', { emote }),
    };
  }, []);
}

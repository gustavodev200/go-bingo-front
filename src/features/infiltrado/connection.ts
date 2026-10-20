'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { toast } from 'sonner';
import {
  INF_NAMESPACE,
  InfClientEvents,
  InfServerEvents,
  type Ack,
  type ErrorCode,
  type InfAct,
  type InfChatMessage,
  type InfClientAckData,
  type InfFrame,
  type InfPublicRoom,
  type InfRoomState,
  type InfRules,
  type InfServerEventName,
  type InfServerEventPayloads,
  type InfSnapshot,
} from '@/contracts';
import { createSocket } from '@/lib/socket';
import { useInfStore, type InfExit } from './store';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Listener = (...args: any[]) => void;

const ACK_TIMEOUT_MS = 5_000;
const CONNECT_TIMEOUT_MS = 8_000;
const JOIN_RETRY_MS = 1_000;
const JOIN_MAX_ATTEMPTS = 5;

let shared: Socket | null = null;

/** One socket for the whole Infiltrado area: the lobby creates the room and the room keeps using it. */
export function infSocket(): Socket {
  shared ??= createSocket(INF_NAMESPACE);
  return shared;
}

export async function emitInf<E extends keyof InfClientAckData>(socket: Socket, event: E, payload: object = {}): Promise<Ack<InfClientAckData[E]>> {
  try {
    return (await socket.timeout(ACK_TIMEOUT_MS).emitWithAck(event, payload)) as Ack<InfClientAckData[E]>;
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

export async function createInfRoom(isPublic: boolean): Promise<Ack<InfSnapshot>> {
  const socket = infSocket();
  if (!(await connected(socket))) return { ok: false, error: { code: 'INTERNAL', message: 'Sem conexão com o servidor' } };
  return emitInf(socket, 'inf:create', { isPublic });
}

/** Public rooms still taking players, kept live while mounted (null while loading). */
export function usePublicInfRooms(): InfPublicRoom[] | null {
  const [rooms, setRooms] = useState<InfPublicRoom[] | null>(null);
  useEffect(() => {
    const socket = infSocket();
    let active = true;
    const watch = () =>
      void emitInf(socket, 'inf:watch_rooms').then((res) => {
        if (active && res.ok) setRooms(res.data);
      });
    const onUpdate = ({ rooms: next }: { rooms: InfPublicRoom[] }) => setRooms(next);
    socket.on(InfServerEvents.ROOMS_UPDATED, onUpdate);
    socket.on('connect', watch);
    if (socket.connected) watch();
    else socket.connect();
    return () => {
      active = false;
      socket.off(InfServerEvents.ROOMS_UPDATED, onUpdate);
      socket.off('connect', watch);
      if (socket.connected) void emitInf(socket, 'inf:unwatch_rooms');
    };
  }, []);
  return rooms;
}

const EXIT_BY_CODE: Partial<Record<ErrorCode, InfExit['reason']>> = {
  NOT_FOUND: 'not_found',
  ROOM_FULL: 'full',
  GAME_IN_PROGRESS: 'in_progress',
};

export interface InfActions {
  leave(): Promise<boolean>;
  ready(ready: boolean): Promise<boolean>;
  setRules(rules: InfRules): Promise<boolean>;
  setVisibility(isPublic: boolean): Promise<boolean>;
  setColor(color: number): Promise<boolean>;
  addBot(): Promise<boolean>;
  removeBot(seat: number): Promise<boolean>;
  start(): Promise<boolean>;
  rematch(): Promise<boolean>;
  /** In-game action; errors show as a toast unless `quiet`. */
  act(action: InfAct, quiet?: boolean): Promise<boolean>;
  chat(text: string): Promise<boolean>;
  /** Fire-and-forget joystick of one client tick. */
  input(seq: number, x: number, y: number): void;
}

export type InfAnnouncement = {
  [E in InfServerEventName]: { event: E; payload: InfServerEventPayloads[E] };
}[InfServerEventName];

export interface InfListeners {
  onAnnouncement(msg: InfAnnouncement): void;
  onFrame(frame: InfFrame): void;
  onChat(message: InfChatMessage): void;
}

/**
 * Joins room `code` and keeps the store in sync. On every (re)connection it
 * joins again, which the server treats as a reconnection to the same seat.
 */
export function useInfRoom(code: string, listeners: InfListeners): InfActions {
  const listenersRef = useRef(listeners);
  useEffect(() => {
    listenersRef.current = listeners;
  }, [listeners]);

  useEffect(() => {
    let active = true;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let joining = true;
    let pending: { event: string; payload: unknown }[] = [];
    useInfStore.getState().reset();
    const socket = infSocket();
    const bound: [string, Listener][] = [];
    const on = (event: string, fn: Listener) => {
      socket.on(event, fn);
      bound.push([event, fn]);
    };

    const handle = (event: string, payload: unknown) => {
      const s = useInfStore.getState();
      switch (event) {
        case InfServerEvents.STATE:
          return s.applyState(payload as InfRoomState);
        case InfServerEvents.FRAME:
          return listenersRef.current.onFrame(payload as InfFrame);
        case InfServerEvents.CHAT:
          return listenersRef.current.onChat(payload as InfChatMessage);
        case InfServerEvents.ROOMS_UPDATED:
          return;
        default: {
          const seq = (payload as { seq?: unknown }).seq;
          if (typeof seq === 'number' && s.accept(seq)) listenersRef.current.onAnnouncement({ event, payload } as InfAnnouncement);
        }
      }
    };

    for (const event of Object.values(InfServerEvents))
      on(event, (payload: unknown) => {
        if (joining) pending.push({ event, payload });
        else handle(event, payload);
      });

    function join(attempt: number) {
      void emitInf(socket, 'inf:join', { code }).then((res) => {
        if (!active || useInfStore.getState().exit) return;
        const s = useInfStore.getState();
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
      if (useInfStore.getState().exit) return;
      joining = true;
      pending = [];
      clearTimeout(retryTimer);
      join(1);
    });
    on('disconnect', () => useInfStore.getState().setConnection('reconnecting'));
    on('connect_error', (error: Error) => {
      if (error.message === 'UNAUTHENTICATED') useInfStore.getState().setExit({ reason: 'error', message: 'Sua sessão expirou. Entre de novo.' });
      else useInfStore.getState().setConnection('reconnecting');
    });

    if (socket.connected) join(1);
    else socket.connect();

    return () => {
      active = false;
      clearTimeout(retryTimer);
      for (const [event, fn] of bound) socket.off(event, fn);
      socket.disconnect();
    };
  }, [code]);

  return useMemo<InfActions>(() => {
    const call = async <E extends keyof InfClientAckData>(event: E, payload: object = {}, quiet = false): Promise<boolean> => {
      const res = await emitInf(infSocket(), event, payload);
      if (!res.ok && !quiet) toast.error(res.error.message, { duration: 1800 });
      return res.ok;
    };
    return {
      leave: async () => {
        const ok = await call('inf:leave');
        if (ok) useInfStore.getState().setExit({ reason: 'left', message: 'Você saiu da sala' });
        return ok;
      },
      ready: (ready) => call('inf:ready', { ready }),
      setRules: (rules) => call('inf:set_rules', { rules }),
      setVisibility: (isPublic) => call('inf:set_visibility', { isPublic }),
      setColor: (color) => call('inf:set_color', { color }),
      addBot: () => call('inf:add_bot'),
      removeBot: (seat) => call('inf:remove_bot', { seat }),
      start: () => call('inf:start'),
      rematch: () => call('inf:rematch'),
      act: (action, quiet) => call('inf:act', action, quiet),
      chat: (text) => call('inf:chat', { text }),
      input: (s, x, y) => {
        const socket = infSocket();
        if (socket.connected) socket.emit(InfClientEvents.INPUT, { s, x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 });
      },
    };
  }, []);
}

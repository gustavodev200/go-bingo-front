'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { toast } from 'sonner';
import {
  SNAKE_NAMESPACE,
  SnakeClientEvents,
  SnakeServerEvents,
  decodeSnakeFrame,
  type Ack,
  type ErrorCode,
  type SnakeClientAckData,
  type SnakeMeta,
  type SnakePublicRoom,
  type SnakeRoomState,
  type SnakeServerEventPayloads,
  type SnakeSnapshot,
} from '@/contracts';
import { createSocket } from '@/lib/socket';
import { useSnakeStore, type SnakeExit } from './store';
import type { SnakeView } from './view';

// Socket.IO listeners receive whatever the server sent; payloads are narrowed per event below.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Listener = (...args: any[]) => void;

const ACK_TIMEOUT_MS = 5_000;
const CONNECT_TIMEOUT_MS = 8_000;
const JOIN_RETRY_MS = 1_000;
const JOIN_MAX_ATTEMPTS = 5;

let shared: Socket | null = null;

/** One socket for the whole Snake.io area: the lobby creates the room and the room keeps using it. */
export function snakeSocket(): Socket {
  shared ??= createSocket(SNAKE_NAMESPACE);
  return shared;
}

export async function emitSnake<E extends keyof SnakeClientAckData>(socket: Socket, event: E, payload: object = {}): Promise<Ack<SnakeClientAckData[E]>> {
  try {
    return (await socket.timeout(ACK_TIMEOUT_MS).emitWithAck(event, payload)) as Ack<SnakeClientAckData[E]>;
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

/** Opens a new room with the player in it. */
export async function createSnakeRoom(isPublic: boolean): Promise<Ack<SnakeSnapshot>> {
  const socket = snakeSocket();
  if (!(await connected(socket))) return { ok: false, error: { code: 'INTERNAL', message: 'Sem conexão com o servidor' } };
  return emitSnake(socket, 'snake:create', { isPublic });
}

/** Public rooms with a free place, kept live while mounted (null while loading). */
export function usePublicSnakeRooms(): SnakePublicRoom[] | null {
  const [rooms, setRooms] = useState<SnakePublicRoom[] | null>(null);
  useEffect(() => {
    const socket = snakeSocket();
    let active = true;
    const watch = () =>
      void emitSnake(socket, 'snake:watch_rooms').then((res) => {
        if (active && res.ok) setRooms(res.data);
      });
    const onUpdate = ({ rooms: next }: { rooms: SnakePublicRoom[] }) => setRooms(next);
    socket.on(SnakeServerEvents.ROOMS_UPDATED, onUpdate);
    socket.on('connect', watch);
    if (socket.connected) watch();
    else socket.connect();
    return () => {
      active = false;
      socket.off(SnakeServerEvents.ROOMS_UPDATED, onUpdate);
      socket.off('connect', watch);
      if (socket.connected) void emitSnake(socket, 'snake:unwatch_rooms');
    };
  }, []);
  return rooms;
}

const EXIT_BY_CODE: Partial<Record<ErrorCode, SnakeExit['reason']>> = { NOT_FOUND: 'not_found', ROOM_FULL: 'full' };

export interface SnakeActions {
  /** Spawns a snake; resolves with an error message or null. */
  play(skin: number): Promise<string | null>;
  leave(): Promise<void>;
  setVisibility(isPublic: boolean): Promise<void>;
  /** Fire-and-forget heading + boost. */
  input(angle: number, boost: boolean): void;
  /** Fire-and-forget visible world size. */
  viewSize(w: number, h: number): void;
}

/**
 * Joins room `code` and keeps the store and the view in sync. On every
 * (re)connection it joins again: same place in the room, but a dropped
 * socket loses its snake (.io rules).
 */
export function useSnakeRoom(code: string, view: SnakeView): SnakeActions {
  useEffect(() => {
    let active = true;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    useSnakeStore.getState().reset();
    const socket = snakeSocket();
    const bound: [string, Listener][] = [];
    const on = (event: string, fn: Listener) => {
      socket.on(event, fn);
      bound.push([event, fn]);
    };

    on(SnakeServerEvents.STATE, (state: SnakeRoomState) => useSnakeStore.getState().applyState(state));
    on(SnakeServerEvents.FRAME, (data: ArrayBuffer) => view.push(decodeSnakeFrame(data)));
    on(SnakeServerEvents.META, ({ meta }: { meta: SnakeMeta[] }) => view.addMeta(meta));
    on(SnakeServerEvents.LEADERBOARD, (lb: SnakeServerEventPayloads['snake:leaderboard']) => useSnakeStore.getState().setLeaderboard(lb));
    on(SnakeServerEvents.FEED, (f: SnakeServerEventPayloads['snake:feed']) => {
      view.onDeath(f.victimId);
      const s = useSnakeStore.getState();
      if (s.phase !== 'playing' || !f.killer) return;
      // Keep the feed calm: only kills involving me or someone on the leaderboard.
      const mine = f.killerId === s.myId || f.victimId === s.myId;
      const top = s.leaderboard?.top.some((r) => r.id === f.killerId || r.id === f.victimId);
      if (mine || top) s.pushFeed(f.killer, f.victim);
    });
    on(SnakeServerEvents.DEAD, (d: SnakeServerEventPayloads['snake:dead']) => {
      view.setMe(0);
      useSnakeStore.getState().died(d);
    });

    function join(attempt: number) {
      void emitSnake(socket, 'snake:join', { code }).then((res) => {
        if (!active || useSnakeStore.getState().exit) return;
        const s = useSnakeStore.getState();
        if (res.ok) {
          view.reset();
          view.setMe(0);
          view.setMeta(res.data.meta);
          s.joined(res.data);
        } else if (res.error.code === 'INTERNAL' && attempt < JOIN_MAX_ATTEMPTS) {
          s.setConnection('reconnecting');
          retryTimer = setTimeout(() => join(attempt + 1), JOIN_RETRY_MS);
        } else s.setExit({ reason: EXIT_BY_CODE[res.error.code] ?? 'error', message: res.error.message });
      });
    }

    on('connect', () => {
      if (useSnakeStore.getState().exit) return;
      clearTimeout(retryTimer);
      join(1);
    });
    on('disconnect', () => useSnakeStore.getState().setConnection('reconnecting'));
    on('connect_error', (error: Error) => {
      if (error.message === 'UNAUTHENTICATED') useSnakeStore.getState().setExit({ reason: 'error', message: 'Sua sessão expirou. Entre de novo.' });
      else useSnakeStore.getState().setConnection('reconnecting');
    });

    if (socket.connected) join(1);
    else socket.connect();

    return () => {
      active = false;
      clearTimeout(retryTimer);
      for (const [event, fn] of bound) socket.off(event, fn);
      // Leaving the page drops the connection; the place stays reserved for the reconnection window.
      socket.disconnect();
    };
  }, [code, view]);

  return useMemo<SnakeActions>(
    () => ({
      play: async (skin) => {
        const res = await emitSnake(snakeSocket(), 'snake:play', { skin });
        if (!res.ok) return res.error.message;
        view.setMe(res.data.id);
        useSnakeStore.getState().playing(res.data.id);
        return null;
      },
      leave: async () => {
        const res = await emitSnake(snakeSocket(), 'snake:leave');
        if (!res.ok) toast.error(res.error.message);
        useSnakeStore.getState().setExit({ reason: 'left', message: 'Você saiu da sala' });
      },
      setVisibility: async (isPublic) => {
        const res = await emitSnake(snakeSocket(), 'snake:set_visibility', { isPublic });
        if (!res.ok) toast.error(res.error.message);
      },
      input: (a, b) => {
        const socket = snakeSocket();
        if (socket.connected) socket.emit(SnakeClientEvents.INPUT, { a: Math.round(a * 1000) / 1000, b });
      },
      viewSize: (w, h) => {
        const socket = snakeSocket();
        if (socket.connected) socket.emit(SnakeClientEvents.VIEW, { w: Math.round(w), h: Math.round(h) });
      },
    }),
    [view],
  );
}

'use client';

import { useEffect, useMemo } from 'react';
import type { Socket } from 'socket.io-client';
import { SNAKE_NAMESPACE, SnakeClientEvents, SnakeServerEvents, decodeSnakeFrame, type Ack, type SnakeClientAckData, type SnakeMeta, type SnakeServerEventPayloads } from '@/contracts';
import { createSocket } from '@/lib/socket';
import { useSnakeStore } from './store';
import type { SnakeView } from './view';

// Socket.IO listeners receive whatever the server sent; payloads are narrowed per event below.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Listener = (...args: any[]) => void;

const ACK_TIMEOUT_MS = 5_000;
const JOIN_RETRY_MS = 1_000;
const JOIN_MAX_ATTEMPTS = 5;

let shared: Socket | null = null;

export function snakeSocket(): Socket {
  shared ??= createSocket(SNAKE_NAMESPACE);
  return shared;
}

export async function emitSnake<E extends keyof SnakeClientAckData>(socket: Socket, event: E, payload: object = {}): Promise<Ack<SnakeClientAckData[E]>> {
  try {
    return (await socket.timeout(ACK_TIMEOUT_MS).emitWithAck(event, payload)) as Ack<SnakeClientAckData[E]>;
  } catch {
    return {
      ok: false,
      error: { code: 'INTERNAL', message: 'Sem resposta do servidor' },
    };
  }
}

export interface SnakeActions {
  /** Spawns a snake; resolves with an error message or null. */
  play(skin: number): Promise<string | null>;
  /** Fire-and-forget heading + boost. */
  input(angle: number, boost: boolean): void;
  /** Fire-and-forget visible world size. */
  viewSize(w: number, h: number): void;
}

/**
 * Enters the open arena and keeps the store and the view in sync. On every
 * (re)connection it joins again (as a spectator: a dropped socket loses its snake).
 */
export function useSnakeArena(view: SnakeView): SnakeActions {
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
      void emitSnake(socket, 'snake:join').then((res) => {
        if (!active) return;
        const s = useSnakeStore.getState();
        if (res.ok) {
          view.reset();
          view.setMe(0);
          view.setMeta(res.data.meta);
          s.joined(res.data);
        } else if (res.error.code === 'INTERNAL' && attempt < JOIN_MAX_ATTEMPTS) {
          s.setConnection('reconnecting');
          retryTimer = setTimeout(() => join(attempt + 1), JOIN_RETRY_MS);
        } else s.setError(res.error.message);
      });
    }

    on('connect', () => {
      clearTimeout(retryTimer);
      join(1);
    });
    on('disconnect', () => useSnakeStore.getState().setConnection('reconnecting'));
    on('connect_error', (error: Error) => {
      if (error.message === 'UNAUTHENTICATED') useSnakeStore.getState().setError('Sua sessão expirou. Entre de novo.');
      else useSnakeStore.getState().setConnection('reconnecting');
    });

    if (socket.connected) join(1);
    else socket.connect();

    return () => {
      active = false;
      clearTimeout(retryTimer);
      for (const [event, fn] of bound) socket.off(event, fn);
      // Leaving the page drops the connection; the server removes the snake.
      socket.disconnect();
    };
  }, [view]);

  return useMemo<SnakeActions>(
    () => ({
      play: async (skin) => {
        const res = await emitSnake(snakeSocket(), 'snake:play', { skin });
        if (!res.ok) return res.error.message;
        view.setMe(res.data.id);
        useSnakeStore.getState().playing(res.data.id);
        return null;
      },
      input: (a, b) => {
        const socket = snakeSocket();
        if (socket.connected)
          socket.emit(SnakeClientEvents.INPUT, {
            a: Math.round(a * 1000) / 1000,
            b,
          });
      },
      viewSize: (w, h) => {
        const socket = snakeSocket();
        if (socket.connected)
          socket.emit(SnakeClientEvents.VIEW, {
            w: Math.round(w),
            h: Math.round(h),
          });
      },
    }),
    [view],
  );
}

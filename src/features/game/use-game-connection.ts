'use client';

import { useEffect, useMemo, useRef } from 'react';
import type { Socket } from 'socket.io-client';
import { toast } from 'sonner';
import { ServerEvents, type Ack, type ClientAckData } from '@/contracts';
import { createGameSocket, emitAck } from '@/lib/socket';
import { useGameStore, type ServerMessage } from './store';

export interface GameActions {
  generateCard(): Promise<void>;
  start(): Promise<void>;
  cancel(): Promise<void>;
  leave(): Promise<void>;
  kick(userId: string): Promise<void>;
  mark(index: number): Promise<void>;
  claim(): Promise<void>;
  replay(): Promise<void>;
}

function report<T>(res: Ack<T>): res is { ok: true; data: T } {
  if (!res.ok) toast.error(res.error.message);
  return res.ok;
}

export function useGameConnection(code: string): GameActions {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    let active = true;
    const socket = createGameSocket();
    socketRef.current = socket;
    const { dispatch, setConnection, setExit } = useGameStore.getState();

    for (const event of Object.values(ServerEvents)) {
      socket.on(event, (payload: unknown) => dispatch({ event, payload } as ServerMessage));
    }
    socket.on('connect', () => {
      void emitAck(socket, 'room:join', { code }).then((res) => {
        if (!active) return;
        if (res.ok) {
          dispatch({ event: 'room:state', payload: res.data });
          setConnection('online');
        } else {
          setExit({ reason: res.error.code === 'NOT_FOUND' ? 'not_found' : 'error', message: res.error.message });
        }
      });
    });
    socket.on('disconnect', () => setConnection('reconnecting'));
    socket.on('connect_error', (error) => {
      if (error.message === 'UNAUTHENTICATED') setExit({ reason: 'error', message: 'Sua sessão expirou. Entre de novo.' });
      else setConnection('reconnecting');
    });
    socket.connect();

    return () => {
      active = false;
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [code]);

  return useMemo<GameActions>(() => {
    const call = <E extends keyof ClientAckData>(event: E, payload: object = {}): Promise<Ack<ClientAckData[E]>> => {
      const socket = socketRef.current;
      if (!socket) return Promise.resolve({ ok: false, error: { code: 'INTERNAL', message: 'Sem conexão' } });
      return emitAck(socket, event, payload);
    };
    const store = () => useGameStore.getState();
    return {
      generateCard: async () => {
        const res = await call('card:generate');
        if (report(res)) store().setMyCard(res.data);
      },
      start: async () => void report(await call('game:start')),
      cancel: async () => void report(await call('room:cancel')),
      leave: async () => void report(await call('room:leave')),
      kick: async (userId) => void report(await call('room:kick', { userId })),
      mark: async (index) => {
        const res = await call('card:mark', { index });
        if (report(res)) store().setMarked(res.data.marked);
      },
      claim: async () => void report(await call('bingo:claim')),
      replay: async () => void report(await call('game:replay')),
    };
  }, []);
}

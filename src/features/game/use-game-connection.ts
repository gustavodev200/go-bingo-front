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

const JOIN_RETRY_MS = 1_000;
const JOIN_MAX_ATTEMPTS = 5;

function report<T>(res: Ack<T>): res is { ok: true; data: T } {
  if (!res.ok) toast.error(res.error.message);
  return res.ok;
}

export function useGameConnection(code: string): GameActions {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    let active = true;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    // Eventos que chegam antes da resposta do room:join são guardados e reaplicados
    // sobre o snapshot (o reducer é idempotente para números repetidos).
    let joining = true;
    let pending: ServerMessage[] = [];
    const socket = createGameSocket();
    socketRef.current = socket;
    const { dispatch, setConnection, setExit } = useGameStore.getState();

    for (const event of Object.values(ServerEvents)) {
      socket.on(event, (payload: unknown) => {
        const msg = { event, payload } as ServerMessage;
        // room:state também chega pelo canal do usuário, inclusive de outra sala da qual ele ainda é membro.
        if (msg.event === 'room:state' && msg.payload.code !== code) return;
        if (joining) pending.push(msg);
        else dispatch(msg);
      });
    }

    function join(attempt: number) {
      void emitAck(socket, 'room:join', { code }).then((res) => {
        if (!active || useGameStore.getState().exit) return;
        if (res.ok) {
          dispatch({ event: 'room:state', payload: res.data });
          pending.forEach(dispatch);
          pending = [];
          joining = false;
          setConnection('online');
        } else if (res.error.code === 'INTERNAL' && attempt < JOIN_MAX_ATTEMPTS) {
          // Sem resposta (rede lenta): tenta de novo em vez de expulsar o jogador.
          setConnection('reconnecting');
          retryTimer = setTimeout(() => join(attempt + 1), JOIN_RETRY_MS);
        } else {
          pending = [];
          setExit({ reason: res.error.code === 'NOT_FOUND' ? 'not_found' : 'error', message: res.error.message });
        }
      });
    }

    socket.on('connect', () => {
      if (useGameStore.getState().exit) return;
      joining = true;
      pending = [];
      clearTimeout(retryTimer);
      join(1);
    });

    // Ao sair (removido, sala encerrada, erro), desliga o socket: reconectar faria um room:join silencioso.
    const unsubscribe = useGameStore.subscribe((state) => {
      if (state.exit && socket.connected) socket.disconnect();
    });
    socket.on('disconnect', () => setConnection('reconnecting'));
    socket.on('connect_error', (error) => {
      if (error.message === 'UNAUTHENTICATED') setExit({ reason: 'error', message: 'Sua sessão expirou. Entre de novo.' });
      else setConnection('reconnecting');
    });
    socket.connect();

    return () => {
      active = false;
      clearTimeout(retryTimer);
      unsubscribe();
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

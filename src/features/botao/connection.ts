'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { toast } from 'sonner';
import {
  BOTAO_NAMESPACE,
  BotaoClientEvents,
  BotaoServerEvents,
  type Ack,
  type BotaoClientAckData,
  type BotaoFrame,
  type BotaoPublicRoom,
  type BotaoRules,
  type BotaoServerEventName,
  type BotaoServerEventPayloads,
  type BotaoSnapshot,
  type ErrorCode,
} from '@/contracts';
import { createSocket } from '@/lib/socket';
import { useBotaoStore, type BotaoExit } from './store';
import type { TickInput } from './input';

// Socket.IO listeners receive whatever the server sent; payloads are narrowed per event below.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Listener = (...args: any[]) => void;

const ACK_TIMEOUT_MS = 5_000;
const CONNECT_TIMEOUT_MS = 8_000;
const JOIN_RETRY_MS = 1_000;
const JOIN_MAX_ATTEMPTS = 5;

let shared: Socket | null = null;

/** Um socket para toda a área do botão: o lobby cria a sala e a sala continua usando. */
export function botaoSocket(): Socket {
  shared ??= createSocket(BOTAO_NAMESPACE);
  return shared;
}

export async function emitBotao<E extends keyof BotaoClientAckData>(socket: Socket, event: E, payload: object = {}): Promise<Ack<BotaoClientAckData[E]>> {
  try {
    return (await socket.timeout(ACK_TIMEOUT_MS).emitWithAck(event, payload)) as Ack<BotaoClientAckData[E]>;
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
export async function createBotaoRoom(isPublic: boolean): Promise<Ack<BotaoSnapshot>> {
  const socket = botaoSocket();
  if (!(await connected(socket))) return { ok: false, error: { code: 'INTERNAL', message: 'Sem conexão com o servidor' } };
  return emitBotao(socket, 'botao:create', { isPublic });
}

/** Salas públicas que ainda aceitam gente, ao vivo enquanto montado (null carregando). */
export function usePublicBotaoRooms(): BotaoPublicRoom[] | null {
  const [rooms, setRooms] = useState<BotaoPublicRoom[] | null>(null);
  useEffect(() => {
    const socket = botaoSocket();
    let active = true;
    const watch = () =>
      void emitBotao(socket, 'botao:watch_rooms').then((res) => {
        if (active && res.ok) setRooms(res.data);
      });
    const onUpdate = ({ rooms: next }: { rooms: BotaoPublicRoom[] }) => setRooms(next);
    socket.on(BotaoServerEvents.ROOMS_UPDATED, onUpdate);
    socket.on('connect', watch);
    if (socket.connected) watch();
    else socket.connect();
    return () => {
      active = false;
      socket.off(BotaoServerEvents.ROOMS_UPDATED, onUpdate);
      socket.off('connect', watch);
      if (socket.connected) void emitBotao(socket, 'botao:unwatch_rooms');
    };
  }, []);
  return rooms;
}

const EXIT_BY_CODE: Partial<Record<ErrorCode, BotaoExit['reason']>> = {
  NOT_FOUND: 'not_found',
  ROOM_FULL: 'full',
  GAME_IN_PROGRESS: 'in_progress',
};

export interface BotaoActions {
  leave(): Promise<boolean>;
  ready(ready: boolean): Promise<boolean>;
  setRules(rules: BotaoRules): Promise<boolean>;
  setVisibility(isPublic: boolean): Promise<boolean>;
  setStake(stake: number): Promise<boolean>;
  setTeam(team: 0 | 1): Promise<boolean>;
  addBot(team?: 0 | 1): Promise<boolean>;
  removeBot(seat: number): Promise<boolean>;
  start(): Promise<boolean>;
  rematch(): Promise<boolean>;
  /** Fire-and-forget input of one client tick. */
  input(seq: number, input: TickInput): void;
}

export type BotaoAnnouncement = {
  [E in BotaoServerEventName]: { event: E; payload: BotaoServerEventPayloads[E] };
}[BotaoServerEventName];

export interface BotaoListeners {
  /** A validated announcement seen for the first time (duplicates are dropped by seq). */
  onAnnouncement(msg: BotaoAnnouncement): void;
  /** Todo quadro do campo, na chegada (inclusive o do snapshot de entrada). */
  onFrame(frame: BotaoFrame): void;
}

/**
 * Joins room `code` and keeps the store in sync. On every (re)connection it
 * joins again, which the server treats as a reconnection to the same seat.
 */
export function useBotaoRoom(code: string, listeners: BotaoListeners): BotaoActions {
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
    useBotaoStore.getState().reset();
    const socket = botaoSocket();
    const bound: [string, Listener][] = [];
    const on = (event: string, fn: Listener) => {
      socket.on(event, fn);
      bound.push([event, fn]);
    };

    const handle = (event: string, payload: unknown) => {
      const s = useBotaoStore.getState();
      switch (event) {
        case BotaoServerEvents.STATE:
          return s.applyState(payload as BotaoRoomStatePayload);
        case BotaoServerEvents.FRAME:
          return listenersRef.current.onFrame(payload as BotaoFrame);
        case BotaoServerEvents.ROOM_CLOSED:
          return s.setExit({ reason: 'not_found', message: 'A sala foi encerrada' });
        default: {
          const seq = (payload as { seq?: unknown }).seq;
          if (typeof seq === 'number' && s.accept(seq)) listenersRef.current.onAnnouncement({ event, payload } as BotaoAnnouncement);
        }
      }
    };

    for (const event of Object.values(BotaoServerEvents))
      on(event, (payload: unknown) => {
        if (joining) pending.push({ event, payload });
        else handle(event, payload);
      });

    function join(attempt: number) {
      void emitBotao(socket, 'botao:join', { code }).then((res) => {
        if (!active || useBotaoStore.getState().exit) return;
        const s = useBotaoStore.getState();
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
      if (useBotaoStore.getState().exit) return;
      joining = true;
      pending = [];
      clearTimeout(retryTimer);
      join(1);
    });
    on('disconnect', () => useBotaoStore.getState().setConnection('reconnecting'));
    on('connect_error', (error: Error) => {
      if (error.message === 'UNAUTHENTICATED') useBotaoStore.getState().setExit({ reason: 'error', message: 'Sua sessão expirou. Entre de novo.' });
      else useBotaoStore.getState().setConnection('reconnecting');
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

  return useMemo<BotaoActions>(() => {
    const call = async <E extends keyof BotaoClientAckData>(event: E, payload: object = {}): Promise<boolean> => {
      const res = await emitBotao(botaoSocket(), event, payload);
      if (!res.ok) toast.error(res.error.message);
      return res.ok;
    };
    return {
      leave: async () => {
        const ok = await call('botao:leave');
        if (ok) useBotaoStore.getState().setExit({ reason: 'left', message: 'Você saiu da sala' });
        return ok;
      },
      ready: (ready) => call('botao:ready', { ready }),
      setRules: (rules) => call('botao:set_rules', { rules }),
      setVisibility: (isPublic) => call('botao:set_visibility', { isPublic }),
      setStake: (stake) => call('botao:set_stake', { stake }),
      setTeam: (team) => call('botao:set_team', { team }),
      addBot: (team) => call('botao:add_bot', team === undefined ? {} : { team }),
      removeBot: (seat) => call('botao:remove_bot', { seat }),
      start: () => call('botao:start'),
      rematch: () => call('botao:rematch'),
      input: (s, { d, k }) => {
        const socket = botaoSocket();
        if (socket.connected) socket.emit(BotaoClientEvents.INPUT, { s, d, k });
      },
    };
  }, []);
}

type BotaoRoomStatePayload = BotaoServerEventPayloads['botao:state'];

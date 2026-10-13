"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import { toast } from "sonner";
import {
  UNO_NAMESPACE,
  UnoServerEvents,
  type Ack,
  type ErrorCode,
  type UnoClientAckData,
  type UnoEmote,
  type UnoPlayOptions,
  type UnoRules,
  type UnoPublicRoom,
  type UnoServerEventPayloads,
  type UnoSnapshot,
} from "@/contracts";
import { createSocket } from "@/lib/socket";
import type { Announced } from "./reactions";
import { useUnoStore, type UnoExit } from "./store";

// Socket.IO listeners receive whatever the server sent; payloads are narrowed per event below.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Listener = (...args: any[]) => void;

const ACK_TIMEOUT_MS = 5_000;
const CONNECT_TIMEOUT_MS = 8_000;
const JOIN_RETRY_MS = 1_000;
const JOIN_MAX_ATTEMPTS = 5;

let shared: Socket | null = null;

/** One socket for the whole UNO area: the lobby creates the table and the room keeps using it. */
export function unoSocket(): Socket {
  shared ??= createSocket(UNO_NAMESPACE);
  return shared;
}

export async function emitUno<E extends keyof UnoClientAckData>(
  socket: Socket,
  event: E,
  payload: object = {},
): Promise<Ack<UnoClientAckData[E]>> {
  try {
    return (await socket
      .timeout(ACK_TIMEOUT_MS)
      .emitWithAck(event, payload)) as Ack<UnoClientAckData[E]>;
  } catch {
    return {
      ok: false,
      error: { code: "INTERNAL", message: "Sem resposta do servidor" },
    };
  }
}

function connected(socket: Socket): Promise<boolean> {
  if (socket.connected) return Promise.resolve(true);
  return new Promise((resolve) => {
    const done = (ok: boolean) => {
      clearTimeout(timer);
      socket.off("connect", onConnect);
      socket.off("connect_error", onError);
      resolve(ok);
    };
    const onConnect = () => done(true);
    const onError = () => done(false);
    const timer = setTimeout(() => done(false), CONNECT_TIMEOUT_MS);
    socket.on("connect", onConnect);
    socket.on("connect_error", onError);
    socket.connect();
  });
}

/** Opens a new table with the player at seat 0. */
export async function createUnoTable(
  isPublic: boolean,
): Promise<Ack<UnoSnapshot>> {
  const socket = unoSocket();
  if (!(await connected(socket)))
    return {
      ok: false,
      error: { code: "INTERNAL", message: "Sem conexão com o servidor" },
    };
  return emitUno(socket, "uno:create", { isPublic });
}

/**
 * Public tables still taking players, kept live while mounted (null while loading).
 * Reconnections watch again, so the list never goes stale.
 */
export function usePublicUnoTables(): UnoPublicRoom[] | null {
  const [rooms, setRooms] = useState<UnoPublicRoom[] | null>(null);
  useEffect(() => {
    const socket = unoSocket();
    let active = true;
    const watch = () =>
      void emitUno(socket, "uno:watch_rooms").then((res) => {
        if (active && res.ok) setRooms(res.data);
      });
    const onUpdate = ({ rooms: next }: { rooms: UnoPublicRoom[] }) =>
      setRooms(next);
    socket.on(UnoServerEvents.ROOMS_UPDATED, onUpdate);
    socket.on("connect", watch);
    if (socket.connected) watch();
    else socket.connect();
    return () => {
      active = false;
      socket.off(UnoServerEvents.ROOMS_UPDATED, onUpdate);
      socket.off("connect", watch);
      if (socket.connected) void emitUno(socket, "uno:unwatch_rooms");
    };
  }, []);
  return rooms;
}

const EXIT_BY_CODE: Partial<Record<ErrorCode, UnoExit["reason"]>> = {
  NOT_FOUND: "not_found",
  ROOM_FULL: "full",
  GAME_IN_PROGRESS: "in_progress",
};

export interface UnoActions {
  leave(): Promise<boolean>;
  ready(ready: boolean): Promise<boolean>;
  setRules(rules: UnoRules): Promise<boolean>;
  setVisibility(isPublic: boolean): Promise<boolean>;
  start(): Promise<boolean>;
  rematch(): Promise<boolean>;
  playCard(cardId: string, opts?: UnoPlayOptions): Promise<boolean>;
  draw(): Promise<boolean>;
  pass(): Promise<boolean>;
  challenge(): Promise<boolean>;
  callUno(): Promise<boolean>;
  catchUno(): Promise<boolean>;
  emote(emote: UnoEmote): Promise<boolean>;
}

export interface UnoListeners {
  /** A validated announcement seen for the first time (duplicates are dropped by seq). */
  onAnnouncement(msg: Announced): void;
  onEmote(payload: UnoServerEventPayloads["uno:emoted"]): void;
  onError(): void;
}

const newActionId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

/**
 * Joins the table `code` and keeps the store in sync. On every (re)connection it
 * joins again, which the server treats as a reconnection to the same seat.
 */
export function useUnoRoom(code: string, listeners: UnoListeners): UnoActions {
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
    const store = useUnoStore.getState();
    store.reset();
    const socket = unoSocket();
    const bound: [string, Listener][] = [];
    const on = (event: string, fn: Listener) => {
      socket.on(event, fn);
      bound.push([event, fn]);
    };

    const handle = (event: string, payload: unknown) => {
      const s = useUnoStore.getState();
      switch (event) {
        case UnoServerEvents.STATE:
          return s.applyState(payload as UnoServerEventPayloads["uno:state"]);
        case UnoServerEvents.PRIVATE_HAND:
          return s.applyHand(
            payload as UnoServerEventPayloads["uno:private_hand"],
          );
        case UnoServerEvents.EMOTED:
          return listenersRef.current.onEmote(
            payload as UnoServerEventPayloads["uno:emoted"],
          );
        case UnoServerEvents.ROOM_CLOSED:
          return s.setExit({
            reason: "not_found",
            message: "A mesa foi encerrada",
          });
        default: {
          const seq = (payload as { seq?: unknown }).seq;
          if (typeof seq === "number" && s.accept(seq))
            listenersRef.current.onAnnouncement({
              event,
              payload,
            } as Announced);
        }
      }
    };

    for (const event of Object.values(UnoServerEvents))
      on(event, (payload: unknown) => {
        if (joining) pending.push({ event, payload });
        else handle(event, payload);
      });

    function join(attempt: number) {
      void emitUno(socket, "uno:join", { code }).then((res) => {
        if (!active || useUnoStore.getState().exit) return;
        const s = useUnoStore.getState();
        if (res.ok) {
          s.applySnapshot(res.data);
          joining = false;
          const queued = pending;
          pending = [];
          queued.forEach((m) => handle(m.event, m.payload));
          s.setConnection("online");
        } else if (
          res.error.code === "INTERNAL" &&
          attempt < JOIN_MAX_ATTEMPTS
        ) {
          s.setConnection("reconnecting");
          retryTimer = setTimeout(() => join(attempt + 1), JOIN_RETRY_MS);
        } else {
          pending = [];
          s.setExit({
            reason: EXIT_BY_CODE[res.error.code] ?? "error",
            message: res.error.message,
          });
        }
      });
    }

    on("connect", () => {
      if (useUnoStore.getState().exit) return;
      joining = true;
      pending = [];
      clearTimeout(retryTimer);
      join(1);
    });
    on("disconnect", () =>
      useUnoStore.getState().setConnection("reconnecting"),
    );
    on("connect_error", (error: Error) => {
      if (error.message === "UNAUTHENTICATED")
        useUnoStore
          .getState()
          .setExit({
            reason: "error",
            message: "Sua sessão expirou. Entre de novo.",
          });
      else useUnoStore.getState().setConnection("reconnecting");
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

  return useMemo<UnoActions>(() => {
    const call = async <E extends keyof UnoClientAckData>(
      event: E,
      payload: object = {},
    ): Promise<boolean> => {
      const res = await emitUno(unoSocket(), event, payload);
      if (!res.ok) {
        toast.error(res.error.message);
        listenersRef.current.onError();
      }
      return res.ok;
    };
    return {
      leave: async () => {
        const ok = await call("uno:leave");
        if (ok)
          useUnoStore
            .getState()
            .setExit({ reason: "left", message: "Você saiu da mesa" });
        return ok;
      },
      ready: (ready) => call("uno:ready", { ready }),
      setRules: (rules) => call("uno:set_rules", { rules }),
      setVisibility: (isPublic) => call("uno:set_visibility", { isPublic }),
      start: () => call("uno:start"),
      rematch: () => call("uno:rematch"),
      playCard: (cardId, opts = {}) =>
        call("uno:play_card", { actionId: newActionId(), cardId, ...opts }),
      draw: () => call("uno:draw", { actionId: newActionId() }),
      pass: () => call("uno:pass", { actionId: newActionId() }),
      challenge: () => call("uno:challenge", { actionId: newActionId() }),
      callUno: () => call("uno:call_uno", { actionId: newActionId() }),
      catchUno: () => call("uno:catch_uno", { actionId: newActionId() }),
      emote: (emote) => call("uno:emote", { emote }),
    };
  }, []);
}

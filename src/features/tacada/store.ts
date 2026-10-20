import { create } from 'zustand';
import type { TacadaEmote, TacadaRoomState, TacadaServerEventPayloads, TacadaSnapshot } from '@/contracts';

export type TacadaConnection = 'connecting' | 'online' | 'reconnecting';

export interface TacadaExit {
  reason: 'not_found' | 'full' | 'in_progress' | 'error' | 'left';
  message: string;
}

export type ShoutTone = 'bet' | 'good' | 'bad' | 'info';

export type TacadaEffect =
  { id: number; kind: 'shout'; text: string; tone: ShoutTone } | { id: number; kind: 'banner'; text: string; tone: ShoutTone } | { id: number; kind: 'emote'; seat: number; emote: TacadaEmote };

export type TacadaShotEvent = TacadaServerEventPayloads['tacada:shot'] & { id: number };

type NewEffect = TacadaEffect extends infer E ? (E extends TacadaEffect ? Omit<E, 'id'> : never) : never;

interface TacadaStore {
  connection: TacadaConnection;
  state: TacadaRoomState | null;
  mySeat: number | null;
  /** Who I am at this table; my seat is looked up by it on every state. */
  myUserId: string | null;
  exit: TacadaExit | null;
  /** Highest announcement sequence handled; anything at or below it is a duplicate. */
  lastSeq: number;
  effects: TacadaEffect[];
  /** Shots waiting to be animated, oldest first. */
  shots: TacadaShotEvent[];
  /** A shot is rolling on the screen: the table shows the animation, not `state.game.balls`. */
  animating: boolean;
  reset(): void;
  queueShot(shot: TacadaServerEventPayloads['tacada:shot']): void;
  /** The canvas took the oldest queued shot. */
  takeShot(id: number): void;
  setAnimating(animating: boolean): void;
  setConnection(connection: TacadaConnection): void;
  setExit(exit: TacadaExit | null): void;
  applySnapshot(snapshot: TacadaSnapshot): void;
  applyState(state: TacadaRoomState): void;
  /** true the first time a sequence number is seen. */
  accept(seq: number): boolean;
  addEffect(effect: NewEffect): number;
  removeEffect(id: number): void;
}

let effectId = 0;

const initial = {
  connection: 'connecting' as TacadaConnection,
  state: null,
  mySeat: null,
  myUserId: null,
  exit: null,
  lastSeq: 0,
  effects: [],
  shots: [],
  animating: false,
};

/** My seat in `state`, or null if I am not seated there (left, expired). */
function seatOf(state: TacadaRoomState, userId: string | null): number | null {
  const i = state.seats.findIndex((s) => s !== null && s.userId === userId);
  return i < 0 ? null : i;
}

/** Older or repeated room states never replace a newer one (the version only grows). */
function newer(current: TacadaRoomState | null, next: TacadaRoomState): boolean {
  return !current || current.code !== next.code || next.version > current.version;
}

export const useTacadaStore = create<TacadaStore>((set, get) => ({
  ...initial,
  reset: () => set({ ...initial }),
  setConnection: (connection) => set({ connection }),
  setExit: (exit) => set({ exit }),
  applySnapshot: ({ state, mySeat }) =>
    set((s) => ({
      state: newer(s.state, state) ? state : s.state,
      lastSeq: s.state && s.state.code !== state.code ? 0 : s.lastSeq,
      mySeat,
      myUserId: state.seats[mySeat]?.userId ?? s.myUserId,
    })),
  applyState: (state) =>
    set((s) => {
      if (!newer(s.state, state)) return {};
      return {
        state,
        mySeat: s.myUserId ? seatOf(state, s.myUserId) : s.mySeat,
      };
    }),
  accept: (seq) => {
    if (seq <= get().lastSeq) return false;
    set({ lastSeq: seq });
    return true;
  },
  addEffect: (effect) => {
    const id = ++effectId;
    set((s) => ({
      effects: [...s.effects.slice(-5), { ...effect, id } as TacadaEffect],
    }));
    return id;
  },
  // Animating starts right away, so reactions to this shot wait for the balls to stop.
  queueShot: (shot) => set((s) => ({ shots: [...s.shots.slice(-3), { ...shot, id: shot.seq }], animating: true })),
  takeShot: (id) => set((s) => ({ shots: s.shots.filter((x) => x.id !== id) })),
  setAnimating: (animating) => {
    if (get().animating !== animating) set({ animating });
  },
  removeEffect: (id) => set((s) => ({ effects: s.effects.filter((e) => e.id !== id) })),
}));

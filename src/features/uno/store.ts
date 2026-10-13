import { create } from 'zustand';
import type { UnoEmote, UnoPrivateHand, UnoRoomState, UnoSnapshot } from '@/contracts';

export type UnoConnection = 'connecting' | 'online' | 'reconnecting';

export interface UnoExit {
  reason: 'not_found' | 'full' | 'in_progress' | 'error' | 'left';
  message: string;
}

export type ShoutTone = 'bet' | 'good' | 'bad' | 'info';

export type UnoEffect =
  { id: number; kind: 'shout'; text: string; tone: ShoutTone } | { id: number; kind: 'banner'; text: string; tone: ShoutTone } | { id: number; kind: 'emote'; seat: number; emote: UnoEmote };

type NewEffect = UnoEffect extends infer E ? (E extends UnoEffect ? Omit<E, 'id'> : never) : never;

interface UnoStore {
  connection: UnoConnection;
  state: UnoRoomState | null;
  mySeat: number | null;
  /** Who I am at this table; my seat is looked up by it on every state. */
  myUserId: string | null;
  hand: UnoPrivateHand | null;
  exit: UnoExit | null;
  /** Highest announcement sequence handled; anything at or below it is a duplicate. */
  lastSeq: number;
  effects: UnoEffect[];
  reset(): void;
  setConnection(connection: UnoConnection): void;
  setExit(exit: UnoExit | null): void;
  applySnapshot(snapshot: UnoSnapshot): void;
  applyState(state: UnoRoomState): void;
  applyHand(hand: UnoPrivateHand): void;
  /** true the first time a sequence number is seen. */
  accept(seq: number): boolean;
  addEffect(effect: NewEffect): number;
  removeEffect(id: number): void;
}

let effectId = 0;

const initial = {
  connection: 'connecting' as UnoConnection,
  state: null,
  mySeat: null,
  myUserId: null,
  hand: null,
  exit: null,
  lastSeq: 0,
  effects: [],
};

/** My seat in `state`, or null if I am not seated there (left, expired). */
function seatOf(state: UnoRoomState, userId: string | null): number | null {
  const i = state.seats.findIndex((s) => s !== null && s.userId === userId);
  return i < 0 ? null : i;
}

/** Older or repeated room states never replace a newer one (the version only grows). */
function newer(current: UnoRoomState | null, next: UnoRoomState): boolean {
  return !current || current.code !== next.code || next.version > current.version;
}

export const useUnoStore = create<UnoStore>((set, get) => ({
  ...initial,
  reset: () => set({ ...initial }),
  setConnection: (connection) => set({ connection }),
  setExit: (exit) => set({ exit }),
  applySnapshot: ({ state, mySeat, hand }) =>
    set((s) => ({
      state: newer(s.state, state) ? state : s.state,
      lastSeq: s.state && s.state.code !== state.code ? 0 : s.lastSeq,
      mySeat,
      myUserId: state.seats[mySeat]?.userId ?? s.myUserId,
      hand,
    })),
  applyState: (state) =>
    set((s) => {
      if (!newer(s.state, state)) return {};
      return {
        state,
        mySeat: s.myUserId ? seatOf(state, s.myUserId) : s.mySeat,
        hand: state.phase === 'LOBBY' ? null : s.hand,
      };
    }),
  applyHand: (hand) =>
    set((s) => {
      if (s.hand && hand.roundNumber < s.hand.roundNumber) return {};
      return { hand };
    }),
  accept: (seq) => {
    if (seq <= get().lastSeq) return false;
    set({ lastSeq: seq });
    return true;
  },
  addEffect: (effect) => {
    const id = ++effectId;
    set((s) => ({
      effects: [...s.effects.slice(-5), { ...effect, id } as UnoEffect],
    }));
    return id;
  },
  removeEffect: (id) => set((s) => ({ effects: s.effects.filter((e) => e.id !== id) })),
}));

import { create } from 'zustand';
import type { BjEmote, BjRoomState, BjSnapshot } from '@/contracts';

export type BjConnection = 'connecting' | 'online' | 'reconnecting';

export interface BjExit {
  reason: 'not_found' | 'full' | 'in_progress' | 'error' | 'left';
  message: string;
}

export type ShoutTone = 'bet' | 'good' | 'bad' | 'info';

export type BjEffect =
  { id: number; kind: 'shout'; text: string; tone: ShoutTone } | { id: number; kind: 'banner'; text: string; tone: ShoutTone } | { id: number; kind: 'emote'; seat: number; emote: BjEmote };

type NewEffect = BjEffect extends infer E ? (E extends BjEffect ? Omit<E, 'id'> : never) : never;

interface BjStore {
  connection: BjConnection;
  state: BjRoomState | null;
  mySeat: number | null;
  /** Who I am at this table; my seat is looked up by it on every state. */
  myUserId: string | null;
  exit: BjExit | null;
  /** Highest announcement sequence handled; anything at or below it is a duplicate. */
  lastSeq: number;
  effects: BjEffect[];
  reset(): void;
  setConnection(connection: BjConnection): void;
  setExit(exit: BjExit | null): void;
  applySnapshot(snapshot: BjSnapshot): void;
  applyState(state: BjRoomState): void;
  /** true the first time a sequence number is seen. */
  accept(seq: number): boolean;
  addEffect(effect: NewEffect): number;
  removeEffect(id: number): void;
}

let effectId = 0;

const initial = {
  connection: 'connecting' as BjConnection,
  state: null,
  mySeat: null,
  myUserId: null,
  exit: null,
  lastSeq: 0,
  effects: [],
};

/** My seat in `state`, or null if I am not seated there (left, expired). */
function seatOf(state: BjRoomState, userId: string | null): number | null {
  const i = state.seats.findIndex((s) => s !== null && s.userId === userId);
  return i < 0 ? null : i;
}

/** Older or repeated room states never replace a newer one (the version only grows). */
function newer(current: BjRoomState | null, next: BjRoomState): boolean {
  return !current || current.code !== next.code || next.version > current.version;
}

export const useBjStore = create<BjStore>((set, get) => ({
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
      effects: [...s.effects.slice(-5), { ...effect, id } as BjEffect],
    }));
    return id;
  },
  removeEffect: (id) => set((s) => ({ effects: s.effects.filter((e) => e.id !== id) })),
}));

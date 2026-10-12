import { create } from 'zustand';
import type { Seat, TrucoGesture, TrucoPrivateHand, TrucoRoomState, TrucoSnapshot } from '@/contracts';

export type TrucoConnection = 'connecting' | 'online' | 'reconnecting';

export interface TrucoExit {
  reason: 'not_found' | 'full' | 'in_progress' | 'error' | 'left';
  message: string;
}

export type ShoutTone = 'bet' | 'good' | 'bad' | 'info';

export type TrucoEffect =
  | { id: number; kind: 'shout'; text: string; tone: ShoutTone }
  | { id: number; kind: 'banner'; text: string; tone: ShoutTone }
  /** gesture = null: somebody made a face, but we do not know which (opponents). */
  | { id: number; kind: 'gesture'; seat: Seat; gesture: TrucoGesture | null };

type NewEffect = TrucoEffect extends infer E ? (E extends TrucoEffect ? Omit<E, 'id'> : never) : never;

interface TrucoStore {
  connection: TrucoConnection;
  state: TrucoRoomState | null;
  mySeat: Seat | null;
  /** Who I am at this table; my seat is looked up by it on every state (seats can change in the lobby). */
  myUserId: string | null;
  hand: TrucoPrivateHand | null;
  exit: TrucoExit | null;
  /** Highest announcement sequence handled; anything at or below it is a duplicate. */
  lastSeq: number;
  effects: TrucoEffect[];
  reset(): void;
  setConnection(connection: TrucoConnection): void;
  setExit(exit: TrucoExit | null): void;
  applySnapshot(snapshot: TrucoSnapshot): void;
  applyState(state: TrucoRoomState): void;
  applyHand(hand: TrucoPrivateHand): void;
  /** true the first time a sequence number is seen. */
  accept(seq: number): boolean;
  addEffect(effect: NewEffect): number;
  removeEffect(id: number): void;
}

let effectId = 0;

const initial = {
  connection: 'connecting' as TrucoConnection,
  state: null,
  mySeat: null,
  myUserId: null,
  hand: null,
  exit: null,
  lastSeq: 0,
  effects: [],
};

/** Older or repeated room states never replace a newer one (the version only grows). */
/** My seat in `state`, or null if I am not seated there (left, expired). */
function seatOf(state: TrucoRoomState, userId: string | null): Seat | null {
  const i = state.seats.findIndex((s) => s !== null && s.userId === userId);
  return i < 0 ? null : (i as Seat);
}

function newer(current: TrucoRoomState | null, next: TrucoRoomState): boolean {
  return !current || current.code !== next.code || next.version > current.version;
}

export const useTrucoStore = create<TrucoStore>((set, get) => ({
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
      // Back in the lobby there is no hand anymore.
      return { state, mySeat: s.myUserId ? seatOf(state, s.myUserId) : s.mySeat, hand: state.phase === 'LOBBY' ? null : s.hand };
    }),
  applyHand: (hand) =>
    set((s) => {
      if (s.hand && hand.handNumber < s.hand.handNumber) return {};
      return { hand };
    }),
  accept: (seq) => {
    if (seq <= get().lastSeq) return false;
    set({ lastSeq: seq });
    return true;
  },
  addEffect: (effect) => {
    const id = ++effectId;
    set((s) => ({ effects: [...s.effects.slice(-5), { ...effect, id } as TrucoEffect] }));
    return id;
  },
  removeEffect: (id) => set((s) => ({ effects: s.effects.filter((e) => e.id !== id) })),
}));

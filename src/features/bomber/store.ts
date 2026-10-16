import { create } from 'zustand';
import type { BomberRoomState, BomberSnapshot } from '@/contracts';

export type BomberConnection = 'connecting' | 'online' | 'reconnecting';

export interface BomberExit {
  reason: 'not_found' | 'full' | 'in_progress' | 'error' | 'left';
  message: string;
}

interface BomberStore {
  connection: BomberConnection;
  state: BomberRoomState | null;
  mySeat: number | null;
  /** Who I am in this room; my seat is looked up by it on every state. */
  myUserId: string | null;
  exit: BomberExit | null;
  /** Highest announcement sequence handled; anything at or below it is a duplicate. */
  lastSeq: number;
  reset(): void;
  setConnection(connection: BomberConnection): void;
  setExit(exit: BomberExit | null): void;
  applySnapshot(snapshot: BomberSnapshot): void;
  applyState(state: BomberRoomState): void;
  /** true the first time a sequence number is seen. */
  accept(seq: number): boolean;
}

const initial = {
  connection: 'connecting' as BomberConnection,
  state: null,
  mySeat: null,
  myUserId: null,
  exit: null,
  lastSeq: 0,
};

function seatOf(state: BomberRoomState, userId: string | null): number | null {
  const i = state.seats.findIndex((s) => s !== null && s.userId === userId);
  return i < 0 ? null : i;
}

/** Older or repeated room states never replace a newer one (the version only grows). */
const newer = (current: BomberRoomState | null, next: BomberRoomState) => !current || current.code !== next.code || next.version > current.version;

/**
 * Room-level state (lobby, scoreboard). Arena frames arrive 30 times a second
 * and bypass React on purpose: they go straight to the canvas loop.
 */
export const useBomberStore = create<BomberStore>((set, get) => ({
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
      return { state, mySeat: s.myUserId ? seatOf(state, s.myUserId) : s.mySeat };
    }),
  accept: (seq) => {
    if (seq <= get().lastSeq) return false;
    set({ lastSeq: seq });
    return true;
  },
}));

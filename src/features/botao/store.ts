import { create } from 'zustand';
import type { BotaoRoomState, BotaoSnapshot } from '@/contracts';

export type BotaoConnection = 'connecting' | 'online' | 'reconnecting';

export interface BotaoExit {
  reason: 'not_found' | 'full' | 'in_progress' | 'error' | 'left';
  message: string;
}

interface BotaoStore {
  connection: BotaoConnection;
  state: BotaoRoomState | null;
  mySeat: number | null;
  /** Who I am in this room; my seat is looked up by it on every state. */
  myUserId: string | null;
  exit: BotaoExit | null;
  /** Highest announcement sequence handled; anything at or below it is a duplicate. */
  lastSeq: number;
  reset(): void;
  setConnection(connection: BotaoConnection): void;
  setExit(exit: BotaoExit | null): void;
  applySnapshot(snapshot: BotaoSnapshot): void;
  applyState(state: BotaoRoomState): void;
  /** true the first time a sequence number is seen. */
  accept(seq: number): boolean;
}

const initial = {
  connection: 'connecting' as BotaoConnection,
  state: null,
  mySeat: null,
  myUserId: null,
  exit: null,
  lastSeq: 0,
};

function seatOf(state: BotaoRoomState, userId: string | null): number | null {
  const i = state.seats.findIndex((s) => s !== null && s.userId === userId);
  return i < 0 ? null : i;
}

/** Older or repeated room states never replace a newer one (the version only grows). */
const newer = (current: BotaoRoomState | null, next: BotaoRoomState) => !current || current.code !== next.code || next.version > current.version;

/**
 * Estado da sala (lobby, placar). Os quadros do campo chegam 30 vezes por segundo
 * e passam longe do React de propósito: vão direto para o canvas.
 */
export const useBotaoStore = create<BotaoStore>((set, get) => ({
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

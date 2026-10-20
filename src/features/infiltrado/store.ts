import { create } from 'zustand';
import type { InfChatMessage, InfRoomState, InfSnapshot } from '@/contracts';

export type InfConnection = 'connecting' | 'online' | 'reconnecting';

export interface InfExit {
  reason: 'not_found' | 'full' | 'in_progress' | 'error' | 'left';
  message: string;
}

const MAX_CHAT = 80;

interface InfStore {
  connection: InfConnection;
  state: InfRoomState | null;
  mySeat: number | null;
  myUserId: string | null;
  exit: InfExit | null;
  lastSeq: number;
  chat: InfChatMessage[];
  /** Messages that arrived while the chat was closed. */
  unread: number;
  reset(): void;
  setConnection(connection: InfConnection): void;
  setExit(exit: InfExit | null): void;
  applySnapshot(snapshot: InfSnapshot): void;
  applyState(state: InfRoomState): void;
  accept(seq: number): boolean;
  addChat(message: InfChatMessage, read: boolean): void;
  clearChat(): void;
  markRead(): void;
}

const initial = {
  connection: 'connecting' as InfConnection,
  state: null,
  mySeat: null,
  myUserId: null,
  exit: null,
  lastSeq: 0,
  chat: [],
  unread: 0,
};

function seatOf(state: InfRoomState, userId: string | null): number | null {
  const i = state.seats.findIndex((s) => s !== null && s.userId === userId);
  return i < 0 ? null : i;
}

const newer = (current: InfRoomState | null, next: InfRoomState) => !current || current.code !== next.code || next.version > current.version;

/**
 * Room-level state (lobby, results) and the meeting chat. Frames bypass React:
 * they go straight to the canvas loop through the bus.
 */
export const useInfStore = create<InfStore>((set, get) => ({
  ...initial,
  reset: () => set({ ...initial }),
  setConnection: (connection) => set({ connection }),
  setExit: (exit) => set({ exit }),
  applySnapshot: ({ state, mySeat, chat }) =>
    set((s) => ({
      state: newer(s.state, state) ? state : s.state,
      lastSeq: s.state && s.state.code !== state.code ? 0 : s.lastSeq,
      mySeat,
      myUserId: state.seats[mySeat]?.userId ?? s.myUserId,
      chat,
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
  addChat: (message, read) => set((s) => (s.chat.some((m) => m.id === message.id) ? {} : { chat: [...s.chat, message].slice(-MAX_CHAT), unread: read ? 0 : s.unread + 1 })),
  clearChat: () => set({ chat: [], unread: 0 }),
  markRead: () => set({ unread: 0 }),
}));

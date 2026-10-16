import { create } from 'zustand';
import type { SnakeRoomState, SnakeServerEventPayloads, SnakeSnapshot } from '@/contracts';

export type SnakeConnection = 'connecting' | 'online' | 'reconnecting';
/** menu = watching before the first life; dead = summary after a life. */
export type SnakePhase = 'menu' | 'playing' | 'dead';

export type SnakeLeaderboard = SnakeServerEventPayloads['snake:leaderboard'];
export type SnakeDeath = SnakeServerEventPayloads['snake:dead'];

export interface SnakeExit {
  reason: 'not_found' | 'full' | 'error' | 'left';
  message: string;
}

export interface SnakeFeedItem {
  key: number;
  killer: string;
  victim: string;
}

interface SnakeStore {
  connection: SnakeConnection;
  phase: SnakePhase;
  room: SnakeRoomState | null;
  radius: number;
  myId: number;
  leaderboard: SnakeLeaderboard | null;
  death: SnakeDeath | null;
  feed: SnakeFeedItem[];
  exit: SnakeExit | null;
  reset(): void;
  setConnection(connection: SnakeConnection): void;
  joined(snapshot: SnakeSnapshot): void;
  applyState(state: SnakeRoomState): void;
  playing(id: number): void;
  died(death: SnakeDeath): void;
  toMenu(): void;
  setLeaderboard(lb: SnakeLeaderboard): void;
  pushFeed(killer: string, victim: string): void;
  setExit(exit: SnakeExit | null): void;
}

const FEED_MAX = 2;
/** Kill notices disappear by themselves so they never sit on the arena. */
const FEED_TTL_MS = 3500;
let feedKey = 0;

const initial = {
  connection: 'connecting' as SnakeConnection,
  phase: 'menu' as SnakePhase,
  room: null,
  radius: 2000,
  myId: 0,
  leaderboard: null,
  death: null,
  feed: [],
  exit: null,
};

/** Older or repeated room states never replace a newer one (the version only grows). */
const newer = (current: SnakeRoomState | null, next: SnakeRoomState) => !current || current.code !== next.code || next.version > current.version;

/**
 * Room-level state for the HUD and overlays. Frames (20/s) never pass
 * through here: they go straight to the canvas loop via SnakeView.
 */
export const useSnakeStore = create<SnakeStore>((set) => ({
  ...initial,
  reset: () => set({ ...initial }),
  setConnection: (connection) => set({ connection }),
  // A (re)join never resumes a life: the server kills the snake when the socket drops.
  joined: ({ state, radius }) => set((s) => ({ room: newer(s.room, state) ? state : s.room, radius, connection: 'online', myId: 0, phase: s.phase === 'playing' ? 'menu' : s.phase })),
  applyState: (state) => set((s) => (newer(s.room, state) ? { room: state } : {})),
  playing: (myId) => set({ myId, phase: 'playing', death: null, feed: [] }),
  died: (death) => set({ death, phase: 'dead', myId: 0 }),
  toMenu: () => set({ phase: 'menu', death: null }),
  setLeaderboard: (leaderboard) => set({ leaderboard }),
  pushFeed: (killer, victim) => {
    const key = ++feedKey;
    set((s) => ({ feed: [{ key, killer, victim }, ...s.feed].slice(0, FEED_MAX) }));
    setTimeout(() => set((s) => ({ feed: s.feed.filter((f) => f.key !== key) })), FEED_TTL_MS);
  },
  setExit: (exit) => set({ exit }),
}));

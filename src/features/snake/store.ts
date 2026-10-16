import { create } from 'zustand';
import type { SnakeJoinData, SnakeServerEventPayloads } from '@/contracts';

export type SnakeConnection = 'connecting' | 'online' | 'reconnecting';
/** menu = spectating before the first life; dead = summary after a life. */
export type SnakePhase = 'menu' | 'playing' | 'dead';

export type SnakeLeaderboard = SnakeServerEventPayloads['snake:leaderboard'];
export type SnakeDeath = SnakeServerEventPayloads['snake:dead'];

export interface SnakeFeedItem {
  key: number;
  killer: string;
  victim: string;
}

interface SnakeStore {
  connection: SnakeConnection;
  phase: SnakePhase;
  arena: number | null;
  radius: number;
  myId: number;
  leaderboard: SnakeLeaderboard | null;
  death: SnakeDeath | null;
  feed: SnakeFeedItem[];
  /** Fatal: the arena can't be used (session expired, all arenas full...). */
  error: string | null;
  reset(): void;
  setConnection(connection: SnakeConnection): void;
  joined(data: SnakeJoinData): void;
  playing(id: number): void;
  died(death: SnakeDeath): void;
  toMenu(): void;
  setLeaderboard(lb: SnakeLeaderboard): void;
  pushFeed(killer: string, victim: string): void;
  setError(error: string | null): void;
}

const FEED_MAX = 4;
let feedKey = 0;

const initial = {
  connection: 'connecting' as SnakeConnection,
  phase: 'menu' as SnakePhase,
  arena: null,
  radius: 3000,
  myId: 0,
  leaderboard: null,
  death: null,
  feed: [],
  error: null,
};

/**
 * Arena-level state for the HUD and overlays. Frames (20/s) never pass
 * through here: they go straight to the canvas loop via SnakeView.
 */
export const useSnakeStore = create<SnakeStore>((set) => ({
  ...initial,
  reset: () => set({ ...initial }),
  setConnection: (connection) => set({ connection }),
  // A (re)join never resumes a life: the server kills the snake when the socket drops.
  joined: ({ arena, radius }) =>
    set((s) => ({
      arena,
      radius,
      connection: 'online',
      myId: 0,
      phase: s.phase === 'playing' ? 'menu' : s.phase,
    })),
  playing: (myId) => set({ myId, phase: 'playing', death: null, feed: [] }),
  died: (death) => set({ death, phase: 'dead', myId: 0 }),
  toMenu: () => set({ phase: 'menu', death: null }),
  setLeaderboard: (leaderboard) => set({ leaderboard }),
  pushFeed: (killer, victim) =>
    set((s) => ({
      feed: [{ key: ++feedKey, killer, victim }, ...s.feed].slice(0, FEED_MAX),
    })),
  setError: (error) => set({ error }),
}));

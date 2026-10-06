import { create } from 'zustand';
import { FREE_INDEX, type Card, type Member, type RoomSnapshot, type ServerEventName, type ServerEventPayloads, type Winner } from '@/contracts';

export type ServerMessage = { [E in ServerEventName]: { event: E; payload: ServerEventPayloads[E] } }[ServerEventName];
export type ExitReason = 'kicked' | 'host_cancelled' | 'empty' | 'not_found' | 'error';
export type ConnectionStatus = 'connecting' | 'online' | 'reconnecting';

export interface GameStoreState {
  myUserId: string | null;
  snapshot: RoomSnapshot | null;
  connection: ConnectionStatus;
  winner: Winner | null;
  endedWithoutWinner: boolean;
  exit: { reason: ExitReason; message?: string } | null;
}

export function initialGameState(myUserId: string | null): GameStoreState {
  return { myUserId, snapshot: null, connection: 'connecting', winner: null, endedWithoutWinner: false, exit: null };
}

function withMembers(snapshot: RoomSnapshot, members: Member[]): RoomSnapshot {
  return { ...snapshot, members: [...members].sort((a, b) => a.slot - b.slot) };
}

export function reduce(state: GameStoreState, msg: ServerMessage): GameStoreState {
  if (msg.event === 'room:state') return { ...state, snapshot: msg.payload, winner: null, endedWithoutWinner: false };
  if (msg.event === 'room:closed') return { ...state, exit: { reason: msg.payload.reason } };
  const s = state.snapshot;
  if (!s) return state;

  switch (msg.event) {
    case 'room:member_joined': {
      const others = s.members.filter((m) => m.userId !== msg.payload.member.userId);
      return { ...state, snapshot: withMembers(s, [...others, msg.payload.member]) };
    }
    case 'room:member_ready':
      return { ...state, snapshot: withMembers(s, s.members.map((m) => (m.userId === msg.payload.userId ? { ...m, hasCard: true } : m))) };
    case 'room:member_left': {
      const { userId, reason } = msg.payload;
      if (reason === 'disconnected') {
        return { ...state, snapshot: withMembers(s, s.members.map((m) => (m.userId === userId ? { ...m, connected: false } : m))) };
      }
      const next = { ...state, snapshot: withMembers(s, s.members.filter((m) => m.userId !== userId)) };
      return userId === state.myUserId && reason === 'kicked' ? { ...next, exit: { reason: 'kicked' } } : next;
    }
    case 'room:host_changed':
      return { ...state, snapshot: { ...s, hostId: msg.payload.hostId } };
    case 'game:number_drawn': {
      if (!s.game || s.game.drawn.includes(msg.payload.number)) return state;
      return { ...state, snapshot: { ...s, game: { ...s.game, drawn: [...s.game.drawn, msg.payload.number] } } };
    }
    case 'game:progress':
      return s.game ? { ...state, snapshot: { ...s, game: { ...s.game, remaining: msg.payload.remaining } } } : state;
    case 'game:won':
      return { ...state, winner: msg.payload, snapshot: { ...s, status: 'WAITING' } };
    case 'game:ended':
      return { ...state, endedWithoutWinner: true, snapshot: { ...s, status: 'WAITING' } };
    default:
      return state;
  }
}

export function selectDrawnSet(state: GameStoreState): Set<number> {
  return new Set(state.snapshot?.game?.drawn ?? []);
}

export function selectCanClaim(state: GameStoreState): boolean {
  const s = state.snapshot;
  if (!s || s.status !== 'IN_GAME' || !s.myCard) return false;
  return new Set(s.myCard.marked.filter((i) => i !== FREE_INDEX)).size === 24;
}

export function selectIsHost(state: GameStoreState): boolean {
  return !!state.snapshot && state.snapshot.hostId === state.myUserId;
}

export function selectReadyCount(state: GameStoreState): number {
  return state.snapshot?.members.filter((m) => m.hasCard).length ?? 0;
}

interface GameStoreActions {
  dispatch(msg: ServerMessage): void;
  reset(myUserId: string): void;
  setConnection(connection: ConnectionStatus): void;
  setExit(exit: GameStoreState['exit']): void;
  setMyCard(card: Card): void;
  setMarked(marked: number[]): void;
}

export const useGameStore = create<GameStoreState & GameStoreActions>((set) => ({
  ...initialGameState(null),
  dispatch: (msg) => set((state) => reduce(state, msg)),
  reset: (myUserId) => set(initialGameState(myUserId)),
  setConnection: (connection) => set({ connection }),
  setExit: (exit) => set({ exit }),
  setMyCard: (card) =>
    set((state) => {
      if (!state.snapshot) return state;
      const members = state.snapshot.members.map((m) => (m.userId === state.myUserId ? { ...m, hasCard: true } : m));
      return { snapshot: { ...state.snapshot, myCard: card, members } };
    }),
  setMarked: (marked) =>
    set((state) => (state.snapshot?.myCard ? { snapshot: { ...state.snapshot, myCard: { ...state.snapshot.myCard, marked } } } : state)),
}));

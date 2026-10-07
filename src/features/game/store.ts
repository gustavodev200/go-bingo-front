import { create } from 'zustand';
import { closestLine, FREE_INDEX, type Card, type Emote, type GameEndedReason, type Member, type RoomSnapshot, type ServerEventName, type ServerEventPayloads, type Winner } from '@/contracts';

export type ServerMessage = { [E in ServerEventName]: { event: E; payload: ServerEventPayloads[E] } }[ServerEventName];
export type ExitReason = 'kicked' | 'host_cancelled' | 'empty' | 'not_found' | 'error';
export type ConnectionStatus = 'connecting' | 'online' | 'reconnecting';

/** Reação rápida ao vivo (some sozinha depois de REACTION_MS). */
export interface Reaction {
  id: number;
  userId: string;
  emote: Emote;
}
/** Teto da fila de reações (rajada de muita gente não cresce a memória). */
export const MAX_REACTIONS = 12;
/** Quanto tempo cada reação fica na tela. */
export const REACTION_MS = 2600;

export interface GameStoreState {
  myUserId: string | null;
  snapshot: RoomSnapshot | null;
  connection: ConnectionStatus;
  winner: Winner | null;
  endedWithoutWinner: boolean;
  /** Por que a partida acabou sem vencedor (null enquanto não acabou assim). */
  endReason: GameEndedReason | null;
  reactions: Reaction[];
  reactionSeq: number;
  exit: { reason: ExitReason; message?: string } | null;
}

export function initialGameState(myUserId: string | null): GameStoreState {
  return { myUserId, snapshot: null, connection: 'connecting', winner: null, endedWithoutWinner: false, endReason: null, reactions: [], reactionSeq: 0, exit: null };
}

function withMembers(snapshot: RoomSnapshot, members: Member[]): RoomSnapshot {
  return { ...snapshot, members: [...members].sort((a, b) => a.slot - b.slot) };
}

export function reduce(state: GameStoreState, msg: ServerMessage): GameStoreState {
  if (msg.event === 'room:state') return { ...state, snapshot: msg.payload, winner: null, endedWithoutWinner: false, endReason: null };
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
    case 'room:emoted': {
      // Só de quem está na sala (um emote atrasado de quem saiu não aparece solto).
      if (!s.members.some((m) => m.userId === msg.payload.userId)) return state;
      const id = state.reactionSeq + 1;
      const reactions = [...state.reactions, { id, userId: msg.payload.userId, emote: msg.payload.emote }].slice(-MAX_REACTIONS);
      return { ...state, reactionSeq: id, reactions };
    }
    case 'game:ended':
      return { ...state, endedWithoutWinner: true, endReason: msg.payload.reason, snapshot: { ...s, status: 'WAITING' } };
    default:
      return state;
  }
}

export function selectDrawnSet(state: GameStoreState): Set<number> {
  return new Set(state.snapshot?.game?.drawn ?? []);
}

/** Quantos números sorteados ainda faltam para mim, pela conta do servidor (null sem cartela/partida). */
export function selectMyRemaining(state: GameStoreState): number | null {
  const s = state.snapshot;
  if (!s?.game || !s.myCard || !state.myUserId) return null;
  return s.game.remaining[state.myUserId] ?? null;
}

export function selectCanClaim(state: GameStoreState): boolean {
  const s = state.snapshot;
  if (!s || s.status !== 'IN_GAME' || !s.myCard) return false;
  // O servidor valida pelos números sorteados, não pela marcação (PRD US-4.4): quem esqueceu
  // de tocar numa casa não perde o bingo. A marcação local cobre o intervalo até o próximo progress.
  if (selectMyRemaining(state) === 0) return true;
  const marked = new Set(s.myCard.marked);
  if (s.winPattern === 'LINE') return closestLine((i) => marked.has(i)) === 0;
  marked.delete(FREE_INDEX);
  return marked.size === 24;
}

/** Entrou com a partida rolando: assiste sem cartela e joga a próxima rodada. */
export function selectIsSpectator(state: GameStoreState): boolean {
  const s = state.snapshot;
  return !!s && s.status === 'IN_GAME' && !s.myCard;
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
  dismissReaction(id: number): void;
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
  dismissReaction: (id) => set((state) => ({ reactions: state.reactions.filter((r) => r.id !== id) })),
  setMarked: (marked) =>
    set((state) => (state.snapshot?.myCard ? { snapshot: { ...state.snapshot, myCard: { ...state.snapshot.myCard, marked } } } : state)),
}));

import { create } from 'zustand';
import type { GaudChatMessage, GaudPrivateHand, GaudRoomState, GaudSeat, GaudSideResult, GaudSnapshot } from '@/contracts';

export type GaudConnection = 'connecting' | 'online' | 'reconnecting';

export interface GaudExit {
  reason: 'not_found' | 'full' | 'in_progress' | 'error' | 'left';
  message: string;
}

export type ShoutTone = 'bet' | 'good' | 'bad' | 'info';

export type GaudEffect =
  | { id: number; kind: 'shout'; text: string; tone: ShoutTone }
  | { id: number; kind: 'banner'; text: string; tone: ShoutTone }
  /** Placa explicando como saiu um envido/flor (quem, quantos pontos, por quê). */
  | { id: number; kind: 'side'; result: GaudSideResult }
  /** Balão de fala do chat em cima de quem falou. */
  | { id: number; kind: 'say'; seat: GaudSeat; text: string; to: GaudChatMessage['to'] };

export type GaudChatEntry = GaudChatMessage & { id: number };

type NewEffect = GaudEffect extends infer E ? (E extends GaudEffect ? Omit<E, 'id'> : never) : never;

interface GaudStore {
  connection: GaudConnection;
  state: GaudRoomState | null;
  mySeat: GaudSeat | null;
  /** Quem sou nesta mesa; meu lugar é procurado por ele a cada estado (no lobby dá para trocar). */
  myUserId: string | null;
  hand: GaudPrivateHand | null;
  exit: GaudExit | null;
  /** Maior seq de anúncio já tratado; igual ou menor é repetido. */
  lastSeq: number;
  effects: GaudEffect[];
  /** Últimas frases do chat desta mesa. */
  chat: GaudChatEntry[];
  reset(): void;
  addChat(message: GaudChatMessage): void;
  setConnection(connection: GaudConnection): void;
  setExit(exit: GaudExit | null): void;
  applySnapshot(snapshot: GaudSnapshot): void;
  applyState(state: GaudRoomState): void;
  applyHand(hand: GaudPrivateHand): void;
  accept(seq: number): boolean;
  addEffect(effect: NewEffect): number;
  removeEffect(id: number): void;
}

let effectId = 0;

const initial = {
  connection: 'connecting' as GaudConnection,
  state: null,
  mySeat: null,
  myUserId: null,
  hand: null,
  exit: null,
  lastSeq: 0,
  effects: [],
  chat: [],
};

function seatOf(state: GaudRoomState, userId: string | null): GaudSeat | null {
  const i = state.seats.findIndex((s) => s !== null && s.userId === userId);
  return i < 0 ? null : (i as GaudSeat);
}

/** Estados mais velhos ou repetidos nunca substituem um mais novo (a versão só cresce). */
function newer(current: GaudRoomState | null, next: GaudRoomState): boolean {
  return !current || current.code !== next.code || next.version > current.version;
}

export const useGaudStore = create<GaudStore>((set, get) => ({
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
    set((s) => ({ effects: [...s.effects.slice(-5), { ...effect, id } as GaudEffect] }));
    return id;
  },
  addChat: (message) => {
    const id = ++effectId;
    set((s) => ({
      chat: [...s.chat.slice(-19), { ...message, id }],
      effects: [...s.effects.slice(-5), { id, kind: 'say', seat: message.seat, text: message.text, to: message.to }],
    }));
  },
  removeEffect: (id) => set((s) => ({ effects: s.effects.filter((e) => e.id !== id) })),
}));

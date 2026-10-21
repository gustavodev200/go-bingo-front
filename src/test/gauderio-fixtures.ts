import type { GaudActions, GaudMatchView, GaudPrivateHand, GaudRoomState, GaudSeat, GaudSeatPlayer } from '@/contracts';
import type { GaudActionsApi } from '@/features/gauderio/connection';

export const NAMES = ['Ana', 'Bia', 'Caio', 'Duda'];
export const userId = (seat: number) => `00000000-0000-4000-8000-00000000000${seat + 1}`;

export function seatPlayer(seat: GaudSeat, over: Partial<GaudSeatPlayer> = {}): GaudSeatPlayer {
  return { seat, team: (seat % 2) as 0 | 1, userId: userId(seat), nickname: NAMES[seat], character: null, bot: false, ready: false, connected: true, reconnectDeadline: null, ...over };
}

export function matchView(over: Partial<GaudMatchView> = {}): GaudMatchView {
  return {
    handNumber: 1,
    dealer: 1,
    mano: 0,
    phase: 'AWAITING_PLAY',
    turn: 0,
    trucoValue: 1,
    trucoLastRaiseTeam: null,
    pending: null,
    trucoOnHold: false,
    envidoClosed: false,
    sideResults: [],
    rounds: [{ plays: [], result: null, winningSeat: null }],
    cardsLeft: [3, 3],
    lastHandResult: null,
    ...over,
  };
}

export function roomState(over: Partial<GaudRoomState> = {}): GaudRoomState {
  return {
    code: 'ABC234',
    version: 1,
    hostId: userId(0),
    isPublic: true,
    stake: 40,
    settings: { size: 2, target: 12, flor: true },
    phase: 'PLAYING',
    lobbyStatus: null,
    seats: [seatPlayer(0, { ready: true }), seatPlayer(1, { ready: true }), null, null],
    scores: [0, 0],
    match: matchView(),
    result: null,
    ...over,
  };
}

export function handActions(over: Partial<GaudActions> = {}): GaudActions {
  return { canPlay: true, canHide: false, canFold: true, calls: ['truco', 'envido', 'real_envido', 'falta_envido'], canAccept: false, canDecline: false, envidoNote: null, ...over };
}

export function privateHand(over: Partial<GaudPrivateHand> = {}): GaudPrivateHand {
  return {
    handNumber: 1,
    cards: [
      { id: 'h1s0c0', card: { rank: 1, suit: 'espadas' } },
      { id: 'h1s0c1', card: { rank: 7, suit: 'copas' } },
      { id: 'h1s0c2', card: { rank: 6, suit: 'copas' } },
    ],
    envido: 33,
    envidoCards: [
      { rank: 7, suit: 'copas' },
      { rank: 6, suit: 'copas' },
    ],
    flor: false,
    actions: handActions(),
    votes: null,
    ...over,
  };
}

export function gaudActions(): GaudActionsApi {
  const ok = () => vi.fn(async () => true);
  return {
    leave: ok(),
    ready: ok(),
    addBot: ok(),
    removeBot: ok(),
    takeSeat: ok(),
    setVisibility: ok(),
    setStake: ok(),
    setSettings: ok(),
    start: ok(),
    rematch: ok(),
    playCard: ok(),
    call: ok(),
    respond: ok(),
    fold: ok(),
    chat: ok(),
  };
}

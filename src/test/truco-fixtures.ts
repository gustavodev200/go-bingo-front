import type { Seat, TrucoMatchView, TrucoPrivateHand, TrucoRoomState, TrucoSeatPlayer } from '@/contracts';

export const NAMES = ['Ana', 'Bia', 'Caio', 'Duda'];
export const userId = (seat: number) => `00000000-0000-4000-8000-00000000000${seat + 1}`;

export function seatPlayer(seat: Seat, over: Partial<TrucoSeatPlayer> = {}): TrucoSeatPlayer {
  return { seat, team: (seat % 2) as 0 | 1, userId: userId(seat), nickname: NAMES[seat], character: null, ready: false, connected: true, reconnectDeadline: null, ...over };
}

export function matchView(over: Partial<TrucoMatchView> = {}): TrucoMatchView {
  return {
    handNumber: 1,
    dealer: 3,
    phase: 'AWAITING_PLAY',
    kind: 'normal',
    tenTeam: null,
    value: 1,
    pendingBet: null,
    lastRaiseTeam: null,
    turn: 0,
    rounds: [{ plays: [], result: null, winningSeat: null }],
    cardsLeft: [3, 3, 3, 3],
    lastHandResult: null,
    ...over,
  };
}

export function roomState(over: Partial<TrucoRoomState> = {}): TrucoRoomState {
  return {
    code: 'ABC234',
    version: 1,
    hostId: userId(0),
    isPublic: true,
    phase: 'PLAYING',
    lobbyStatus: null,
    seats: ([0, 1, 2, 3] as Seat[]).map((s) => seatPlayer(s)),
    scores: [0, 0],
    match: matchView(),
    result: null,
    ...over,
  };
}

export function privateHand(over: Partial<TrucoPrivateHand> = {}): TrucoPrivateHand {
  return {
    handNumber: 1,
    cards: [
      { id: 'h1s0c0', card: { rank: '4', suit: 'clubs' } },
      { id: 'h1s0c1', card: { rank: '3', suit: 'hearts' } },
      { id: 'h1s0c2', card: { rank: 'Q', suit: 'spades' } },
    ],
    partnerCards: null,
    ...over,
  };
}

import { DEFAULT_BJ_RULES, type BjGameView, type BjHandView, type BjPlayerView, type BjRoomState, type BjSeatPlayer } from '@/contracts';

export const NAMES = ['Ana', 'Bia', 'Caio', 'Duda', 'Edu'];
export const userId = (seat: number) => `00000000-0000-4000-8000-00000000000${seat + 1}`;

export function seatPlayer(seat: number, over: Partial<BjSeatPlayer> = {}): BjSeatPlayer {
  return {
    seat,
    userId: userId(seat),
    nickname: NAMES[seat],
    character: null,
    bot: false,
    ready: false,
    connected: true,
    reconnectDeadline: null,
    ...over,
  };
}

export function hand(over: Partial<BjHandView> = {}): BjHandView {
  return { cards: ['TS', '6H'], bet: 100, total: 16, soft: false, status: 'playing', split: false, outcome: null, net: 0, ...over };
}

export function playerView(seat: number, over: Partial<BjPlayerView> = {}): BjPlayerView {
  return { seat, chips: 900, bet: 100, hands: [hand()], insurance: null, insuranceNet: 0, broke: false, left: false, roundNet: 0, ...over };
}

/** Round 1, my turn (Ana, seat 0) with 16 against a dealer 9. */
export function gameView(over: Partial<BjGameView> = {}): BjGameView {
  return {
    round: 1,
    stage: 'PLAYING',
    dealer: { cards: ['9H', null], total: 9, soft: false, blackjack: false },
    players: [playerView(0), playerView(1, { hands: [hand({ cards: ['KD', '8C'], total: 18 })] })],
    turn: { seat: 0, hand: 0 },
    actions: ['hit', 'stand', 'double', 'surrender'],
    shoeLeft: 300,
    shoeSize: 312,
    deadline: null,
    ...over,
  };
}

export function roomState(over: Partial<BjRoomState> = {}): BjRoomState {
  return {
    code: 'ABC234',
    version: 1,
    hostId: userId(0),
    isPublic: true,
    stake: 30,
    rules: { ...DEFAULT_BJ_RULES },
    phase: 'PLAYING',
    lobbyStatus: null,
    seats: [seatPlayer(0), seatPlayer(1), null, null, null],
    game: gameView(),
    result: null,
    ...over,
  };
}

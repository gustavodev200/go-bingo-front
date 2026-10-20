import { rackBalls, rackOrder, type TacadaGameView, type TacadaRoomState, type TacadaSeatPlayer } from '@/contracts';

export const NAMES = ['Ana', 'Bia'];
export const userId = (seat: number) => `00000000-0000-4000-8000-00000000000${seat + 1}`;

export function seatPlayer(seat: number, over: Partial<TacadaSeatPlayer> = {}): TacadaSeatPlayer {
  return {
    seat,
    userId: userId(seat),
    nickname: NAMES[seat],
    character: null,
    ready: false,
    connected: true,
    reconnectDeadline: null,
    ...over,
  };
}

/** Fresh rack, Ana (seat 0) breaking with the cue ball in hand. */
export function gameView(over: Partial<TacadaGameView> = {}): TacadaGameView {
  return {
    balls: rackBalls(rackOrder((min) => min)),
    turn: 0,
    groups: [null, null],
    ballInHand: true,
    breakShot: true,
    onEight: false,
    fouls: [0, 0],
    lastShot: null,
    shots: 0,
    readyAt: 0,
    turnDeadline: null,
    ...over,
  };
}

export function roomState(over: Partial<TacadaRoomState> = {}): TacadaRoomState {
  return {
    code: 'ABC234',
    version: 1,
    hostId: userId(0),
    isPublic: true,
    stake: 30,
    rules: { shotSeconds: 30, aimGuide: 'long' },
    phase: 'PLAYING',
    lobbyStatus: null,
    seats: [seatPlayer(0), seatPlayer(1)],
    breakerSeat: 0,
    game: gameView(),
    result: null,
    ...over,
  };
}

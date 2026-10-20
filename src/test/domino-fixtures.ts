import type { DominoPrivateHand, DominoRoomState, DominoRoundView, DominoSeatPlayer } from '@/contracts';

export const NAMES = ['Ana', 'Bia', 'Caio', 'Duda'];
export const userId = (seat: number) => `00000000-0000-4000-8000-00000000000${seat + 1}`;

export function seatPlayer(seat: number, over: Partial<DominoSeatPlayer> = {}): DominoSeatPlayer {
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

/** Ana (seat 0) to play on a line 1|6 6|6 6|3, with Bia and Caio holding 6 tiles. */
export function roundView(over: Partial<DominoRoundView> = {}): DominoRoundView {
  return {
    roundNumber: 1,
    phase: 'PLAYING',
    turn: 0,
    line: [
      { a: 1, b: 6, seat: 2 },
      { a: 6, b: 6, seat: 0 },
      { a: 6, b: 3, seat: 1 },
    ],
    origin: 1,
    ends: [1, 3],
    boneyard: 7,
    handCounts: [3, 6, 6, 0],
    lastRound: null,
    turnDeadline: null,
    ...over,
  };
}

export function roomState(over: Partial<DominoRoomState> = {}): DominoRoomState {
  return {
    code: 'ABC234',
    version: 1,
    hostId: userId(0),
    isPublic: true,
    stake: 30,
    rules: { target: 0, teams: false },
    phase: 'PLAYING',
    lobbyStatus: null,
    seats: [seatPlayer(0), seatPlayer(1), seatPlayer(2), null],
    scores: [0, 0, 0, 0],
    round: roundView(),
    result: null,
    ...over,
  };
}

/** 1|3 fits both ends (1 and 3), 3|5 only the right one, 2|4 none. */
export function privateHand(over: Partial<DominoPrivateHand> = {}): DominoPrivateHand {
  return {
    roundNumber: 1,
    tiles: [
      { id: 'r1t0', tile: { a: 1, b: 3 } },
      { id: 'r1t1', tile: { a: 3, b: 5 } },
      { id: 'r1t2', tile: { a: 2, b: 4 } },
    ],
    playable: [
      { id: 'r1t0', sides: ['left', 'right'] },
      { id: 'r1t1', sides: ['right'] },
    ],
    mustDraw: false,
    ...over,
  };
}

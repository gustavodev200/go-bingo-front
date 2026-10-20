import { DAMAS_INITIAL_BOARD, damasSquare, type DamasGameView, type DamasRoomState, type DamasSeatPlayer } from '@/contracts';

export const NAMES = ['Ana', 'Bia'];
export const userId = (seat: number) => `00000000-0000-4000-8000-00000000000${seat + 1}`;

export function seatPlayer(seat: number, over: Partial<DamasSeatPlayer> = {}): DamasSeatPlayer {
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

/** Opening position, white (Ana, seat 0) to move with two of her moves listed. */
export function gameView(over: Partial<DamasGameView> = {}): DamasGameView {
  return {
    board: DAMAS_INITIAL_BOARD,
    turn: 'white',
    moves: [
      { from: damasSquare(5, 0), path: [damasSquare(4, 1)], captures: [] },
      { from: damasSquare(5, 2), path: [damasSquare(4, 1)], captures: [] },
      { from: damasSquare(5, 2), path: [damasSquare(4, 3)], captures: [] },
    ],
    lastMove: null,
    quietMoves: 0,
    plies: 0,
    drawOffer: null,
    timeouts: [0, 0],
    turnDeadline: null,
    ...over,
  };
}

export function roomState(over: Partial<DamasRoomState> = {}): DamasRoomState {
  return {
    code: 'ABC234',
    version: 1,
    hostId: userId(0),
    isPublic: true,
    stake: 30,
    rules: { turnSeconds: 60 },
    phase: 'PLAYING',
    lobbyStatus: null,
    seats: [seatPlayer(0), seatPlayer(1)],
    whiteSeat: 0,
    game: gameView(),
    result: null,
    ...over,
  };
}

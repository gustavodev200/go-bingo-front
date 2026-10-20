import { BOMBER_COLS, BOMBER_ROWS, BOMBER_TILE, type BomberFrame, type BomberFramePlayer, type BomberRoomState, type BomberSeatPlayer } from '@/contracts';

export const NAMES = ['Ana', 'Bia', 'Caio', 'Duda', 'Edu', 'Fê', 'Gui', 'Hugo'];
export const userId = (seat: number) => `00000000-0000-4000-8000-00000000000${seat + 1}`;

export function seatPlayer(seat: number, over: Partial<BomberSeatPlayer> = {}): BomberSeatPlayer {
  return { seat, userId: userId(seat), nickname: NAMES[seat], character: null, color: seat, bot: false, ready: false, connected: true, reconnectDeadline: null, ...over };
}

export function roomState(over: Partial<BomberRoomState> = {}): BomberRoomState {
  return {
    code: 'ABC234',
    version: 1,
    hostId: userId(0),
    isPublic: true,
    stake: 30,
    rules: { winsToWin: 3 },
    phase: 'PLAYING',
    lobbyStatus: null,
    seats: [seatPlayer(0), seatPlayer(1), null, null, null, null, null, null],
    wins: [0, 0, 0, 0, 0, 0, 0, 0],
    roundNumber: 1,
    result: null,
    ...over,
  };
}

/** Open arena: border and pillars only. */
export function openGrid(): string {
  let g = '';
  for (let y = 0; y < BOMBER_ROWS; y++)
    for (let x = 0; x < BOMBER_COLS; x++) g += x === 0 || y === 0 || x === BOMBER_COLS - 1 || y === BOMBER_ROWS - 1 || (x % 2 === 0 && y % 2 === 0) ? BOMBER_TILE.HARD : BOMBER_TILE.FLOOR;
  return g;
}

export function framePlayer(seat: number, over: Partial<{ x: number; y: number; alive: 0 | 1; lastSeq: number; speed: number; curse: BomberFramePlayer[7]; flags: number }> = {}): BomberFramePlayer {
  const o = { x: 1, y: 1, alive: 1 as const, lastSeq: 0, speed: 3.4, curse: 0 as const, flags: 0, ...over };
  return [seat, o.x, o.y, 2, 0, o.alive, o.speed, o.curse, o.lastSeq, 0, 1, 2, 0, o.flags];
}

export function frame(over: Partial<BomberFrame> = {}): BomberFrame {
  return {
    roundNumber: 1,
    phase: 'play',
    phaseLeft: 0,
    timeLeft: 120,
    grid: openGrid(),
    players: [framePlayer(0), framePlayer(1, { x: 13, y: 11 })],
    bombs: [],
    flames: [],
    drops: [],
    events: [],
    ...over,
  };
}

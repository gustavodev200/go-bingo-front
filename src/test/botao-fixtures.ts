import type { BotaoFrame, BotaoFramePlayer, BotaoRoomState, BotaoSeatPlayer } from '@/contracts';

export const NAMES = ['Ana', 'Bia', 'Caio', 'Duda', 'Edu', 'Fê', 'Gui', 'Hugo'];
export const userId = (seat: number) => `00000000-0000-4000-8000-00000000000${seat + 1}`;

export function seatPlayer(seat: number, over: Partial<BotaoSeatPlayer> = {}): BotaoSeatPlayer {
  return { seat, userId: userId(seat), nickname: NAMES[seat], character: null, bot: false, ready: false, connected: true, reconnectDeadline: null, ...over };
}

/** Ana (vermelho, lugar 0) contra Edu (azul, lugar 4). */
export function roomState(over: Partial<BotaoRoomState> = {}): BotaoRoomState {
  return {
    code: 'ABC234',
    version: 1,
    hostId: userId(0),
    isPublic: true,
    stake: 30,
    rules: { minutes: 3, goals: 3 },
    phase: 'PLAYING',
    lobbyStatus: null,
    seats: [seatPlayer(0), null, null, null, seatPlayer(4), null, null, null],
    score: [0, 0],
    goals: [],
    result: null,
    ...over,
  };
}

export function framePlayer(seat: number, over: Partial<{ x: number; y: number; vx: number; vy: number; kick: 0 | 1; lastSeq: number }> = {}): BotaoFramePlayer {
  const o = { x: seat < 4 ? -150 : 150, y: 0, vx: 0, vy: 0, kick: 0 as const, lastSeq: 0, ...over };
  return [seat, o.x, o.y, o.vx, o.vy, o.kick, o.lastSeq];
}

export function frame(over: Partial<BotaoFrame> = {}): BotaoFrame {
  return {
    phase: 'play',
    phaseLeft: 0,
    clock: 170,
    overtime: false,
    kickTeam: 0,
    score: [0, 0],
    players: [framePlayer(0), framePlayer(4)],
    ball: [0, 0, 0, 0],
    events: [],
    ...over,
  };
}

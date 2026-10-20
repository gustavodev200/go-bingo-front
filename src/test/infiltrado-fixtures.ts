import { DEFAULT_INF_RULES, type InfFrame, type InfMe, type InfRoomState, type InfSeatPlayer } from '@/contracts';

export function seatPlayer(seat: number, over: Partial<InfSeatPlayer> = {}): InfSeatPlayer {
  return { seat, userId: `u${seat}`, nickname: `P${seat}`, character: null, color: seat, bot: false, ready: false, connected: true, reconnectDeadline: null, ...over };
}

export function roomState(over: Partial<InfRoomState> = {}, players = 4): InfRoomState {
  return {
    code: 'ABC123',
    version: 1,
    hostId: 'u0',
    isPublic: true,
    stake: 30,
    rules: { ...DEFAULT_INF_RULES },
    phase: 'LOBBY',
    lobbyStatus: 'WAITING_PLAYERS',
    seats: Array.from({ length: 15 }, (_, i) => (i < players ? seatPlayer(i) : null)),
    result: null,
    ...over,
  };
}

export function me(over: Partial<InfMe> = {}): InfMe {
  return { x: 32, y: 17, alive: true, role: 'crew', mates: [], lastSeq: 0, killCd: 0, sabotageCd: 0, vent: -1, meetingsLeft: 1, tasks: [[8, 0]], holding: -1, ...over };
}

export function frame(over: Partial<InfFrame> = {}): InfFrame {
  return { phase: 'play', phaseLeft: 0, me: me(), players: [], bodies: [], taskBar: 0, sabotage: null, buttonCd: 0, meeting: null, eject: null, events: [], ...over };
}

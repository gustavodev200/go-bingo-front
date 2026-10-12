import { TRUCO_BET_LADDER, teamOf, type Seat, type Team, type TrucoRoomState, type TrucoRoundView } from '@/contracts';

/** Where a seat sits on screen: the player is always at the bottom, play goes to their right. */
export type TablePosition = 'bottom' | 'right' | 'top' | 'left';
const POSITIONS: TablePosition[] = ['bottom', 'right', 'top', 'left'];

export function positionOf(seat: Seat, mySeat: Seat): TablePosition {
  return POSITIONS[(seat - mySeat + 4) % 4];
}

export const teamLabel = (team: Team, myTeam: Team) => (team === myTeam ? 'Nós' : 'Eles');

export const BET_LABEL: Record<number, string> = { 4: 'Truco', 6: 'Seis', 10: 'Dez', 12: 'Doze' };

export function nextBet(value: number): number | null {
  const i = TRUCO_BET_LADDER.indexOf(value as (typeof TRUCO_BET_LADDER)[number]);
  return i >= 0 && i < TRUCO_BET_LADDER.length - 1 ? TRUCO_BET_LADDER[i + 1] : null;
}

export interface AvailableActions {
  myTurn: boolean;
  canPlay: boolean;
  /** Value a truco request would ask for, or null when not allowed now. */
  requestValue: number | null;
  /** The opponents asked: we may accept, run or raise to `raiseValue`. */
  mustRespond: boolean;
  raiseValue: number | null;
  /** We asked and wait for the opponents. */
  waitingResponse: boolean;
  /** Mão de dez: 'mine' when our team decides, 'theirs' when we wait. */
  tenDecision: 'mine' | 'theirs' | null;
}

const NONE: AvailableActions = {
  myTurn: false,
  canPlay: false,
  requestValue: null,
  mustRespond: false,
  raiseValue: null,
  waitingResponse: false,
  tenDecision: null,
};

/** Mirrors the server rules to show only the buttons that make sense (the server still validates everything). */
export function availableActions(state: TrucoRoomState | null, mySeat: Seat | null): AvailableActions {
  const m = state?.match;
  if (!m || mySeat === null || state.phase !== 'PLAYING') return NONE;
  const myTeam = teamOf(mySeat);
  const myTurn = m.turn === mySeat && (m.phase === 'AWAITING_PLAY' || m.phase === 'AWAITING_BET_RESPONSE');
  const pending = m.pendingBet;
  return {
    myTurn,
    canPlay: m.phase === 'AWAITING_PLAY' && m.turn === mySeat,
    requestValue: m.phase === 'AWAITING_PLAY' && m.turn === mySeat && m.kind === 'normal' && m.lastRaiseTeam !== myTeam ? nextBet(m.value) : null,
    mustRespond: m.phase === 'AWAITING_BET_RESPONSE' && pending !== null && pending.team !== myTeam,
    raiseValue: m.phase === 'AWAITING_BET_RESPONSE' && pending !== null && pending.team !== myTeam ? nextBet(pending.value) : null,
    waitingResponse: m.phase === 'AWAITING_BET_RESPONSE' && pending !== null && pending.team === myTeam,
    tenDecision: m.phase === 'AWAITING_TEN_DECISION' ? (m.tenTeam === myTeam ? 'mine' : 'theirs') : null,
  };
}

/** The round shown in the middle of the table: the current one, or the last finished one while the next is empty. */
export function visibleRound(state: TrucoRoomState | null): { round: TrucoRoundView; number: number } | null {
  const rounds = state?.match?.rounds;
  if (!rounds?.length) return null;
  const current = rounds[rounds.length - 1];
  if (current.plays.length === 0 && rounds.length > 1) return { round: rounds[rounds.length - 2], number: rounds.length - 1 };
  return { round: current, number: rounds.length };
}

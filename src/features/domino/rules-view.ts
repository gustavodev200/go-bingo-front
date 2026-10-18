import { DOMINO_SEATS, dominoTeamOf, type DominoPrivateHand, type DominoRoomState, type DominoRules, type DominoSide, type DominoTile } from '@/contracts';

export const TARGET_LABEL: Record<number, string> = {
  0: 'Rodada única',
  50: 'Até 50 pontos',
  100: 'Até 100 pontos',
};

export const TEAM_NAME = ['Dupla A', 'Dupla B'] as const;

/** Short summary of the table rules ("Até 50 pontos · Duplas"). */
export function rulesLabel(rules: DominoRules): string {
  return `${TARGET_LABEL[rules.target]}${rules.teams ? ' · Duplas' : ''}`;
}

const PIP_NAME = ['branco', 'ás', 'duque', 'terno', 'quadra', 'quina', 'sena'];

/** Accessible name of a tile, in Portuguese ("Carroça de sena", "3 e 5"). */
export function tileLabel(tile: DominoTile): string {
  if (tile.a === tile.b) return `Carroça de ${PIP_NAME[tile.a]}`;
  return `${Math.min(tile.a, tile.b)} e ${Math.max(tile.a, tile.b)}`;
}

/** Where an opponent sits around the table, seen from me at the bottom. */
export type SeatSpot = 'right' | 'top' | 'left';

/**
 * Other seated players in play order, starting with the one who plays after
 * me. Play is anti-clockwise, so the next one sits on my right.
 */
export function opponentsOf(state: DominoRoomState, mySeat: number): { seat: number; spot: SeatSpot }[] {
  const seats: number[] = [];
  for (let i = 1; i < DOMINO_SEATS; i++) {
    const seat = (mySeat + i) % DOMINO_SEATS;
    if (state.seats[seat]) seats.push(seat);
  }
  // With 3 opponents my partner (2 against 2) is the one across, at the top.
  const spots: Record<number, SeatSpot[]> = { 1: ['top'], 2: ['right', 'left'], 3: ['right', 'top', 'left'] };
  return seats.map((seat, i) => ({ seat, spot: spots[seats.length][i] }));
}

export interface DominoAvailable {
  myTurn: boolean;
  /** Tile id → ends where it fits (from the server). */
  playable: ReadonlyMap<string, DominoSide[]>;
  /** No tile fits and the boneyard still has tiles. */
  mustDraw: boolean;
}

const NONE: DominoAvailable = { myTurn: false, playable: new Map(), mustDraw: false };

/** What the player can do right now (the server validates again). */
export function availableActions(state: DominoRoomState, hand: DominoPrivateHand | null, mySeat: number): DominoAvailable {
  const round = state.round;
  if (state.phase !== 'PLAYING' || !round || round.phase !== 'PLAYING' || round.turn !== mySeat) return NONE;
  return {
    myTurn: true,
    playable: new Map((hand?.playable ?? []).map((p) => [p.id, p.sides])),
    mustDraw: hand?.mustDraw ?? false,
  };
}

/**
 * The end to play a tile on without asking, or null when the player must
 * choose: the tile fits both ends and they show different numbers.
 */
export function autoSide(sides: readonly DominoSide[], ends: [number, number] | null): DominoSide | undefined | null {
  if (sides.length === 1) return sides[0];
  if (!ends || ends[0] === ends[1]) return undefined;
  return null;
}

/** Seats that share a result with `seat` (just itself, or both partners). */
export function sideOf(state: DominoRoomState, seat: number): number[] {
  if (!state.rules.teams) return [seat];
  return state.seats.flatMap((s, i) => (s && dominoTeamOf(i) === dominoTeamOf(seat) ? [i] : []));
}

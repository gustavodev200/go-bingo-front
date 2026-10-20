import { DAMAS_PIECES, DAMAS_SQUARES, damasColorOf, type DamasCell, type DamasColor, type DamasMove, type DamasRoomState } from '@/contracts';

/** Board squares in screen order: my own pieces always start at the bottom (black sees the board turned around). */
export function screenOrder(color: DamasColor): number[] {
  const squares = Array.from({ length: DAMAS_SQUARES }, (_, i) => i);
  return color === 'white' ? squares : squares.reverse();
}

export const colorOfCell = (cell: DamasCell): DamasColor | null => (cell === '.' ? null : cell === 'w' || cell === 'W' ? 'white' : 'black');
export const isKing = (cell: DamasCell) => cell === 'W' || cell === 'B';

export function myColor(state: DamasRoomState, mySeat: number): DamasColor {
  return damasColorOf(state, mySeat);
}

/** Pieces each colour has captured so far. */
export function capturedBy(board: string): Record<DamasColor, number> {
  let white = 0;
  let black = 0;
  for (const c of board) {
    if (c === 'w' || c === 'W') white++;
    else if (c === 'b' || c === 'B') black++;
  }
  return { white: DAMAS_PIECES - black, black: DAMAS_PIECES - white };
}

/** Where a selection stands: the piece, the squares already chosen and what can come next. */
export interface Selection {
  from: number;
  path: number[];
}

/** Squares with a piece that has at least one legal move. */
export const movablePieces = (moves: readonly DamasMove[]) => new Set(moves.map((m) => m.from));

/** Legal moves still compatible with a (partial) selection. */
export function candidates(moves: readonly DamasMove[], sel: Selection): DamasMove[] {
  return moves.filter((m) => m.from === sel.from && sel.path.every((sq, i) => m.path[i] === sq));
}

/** Squares the selected piece may land on next. */
export function nextTargets(moves: readonly DamasMove[], sel: Selection): Set<number> {
  const out = new Set<number>();
  for (const m of candidates(moves, sel)) if (m.path.length > sel.path.length) out.add(m.path[sel.path.length]);
  return out;
}

/** Pieces taken so far by a partial capture (shown dimmed while choosing the rest). */
export function pendingCaptures(moves: readonly DamasMove[], sel: Selection): Set<number> {
  const first = candidates(moves, sel)[0];
  return new Set(first ? first.captures.slice(0, sel.path.length) : []);
}

export type TapResult = { kind: 'select'; selection: Selection | null } | { kind: 'move'; move: DamasMove };

/**
 * What tapping a square does: pick (or switch) a piece, take the next step of
 * a capture, or play the move once the path is complete. Every legal path has
 * the same length (majority rule), so a complete path is never ambiguous.
 */
export function tap(moves: readonly DamasMove[], sel: Selection | null, square: number): TapResult {
  if (sel && nextTargets(moves, sel).has(square)) {
    const next = { from: sel.from, path: [...sel.path, square] };
    const done = candidates(moves, next).find((m) => m.path.length === next.path.length);
    if (done) return { kind: 'move', move: done };
    return { kind: 'select', selection: next };
  }
  if (movablePieces(moves).has(square)) {
    if (sel && sel.from === square && sel.path.length === 0) return { kind: 'select', selection: null };
    return { kind: 'select', selection: { from: square, path: [] } };
  }
  return { kind: 'select', selection: null };
}

/** The piece to preselect when only one can move (common during captures). */
export function onlyMovable(moves: readonly DamasMove[]): number | null {
  const pieces = movablePieces(moves);
  return pieces.size === 1 ? [...pieces][0] : null;
}

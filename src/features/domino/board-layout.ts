import type { DominoPlaced } from '@/contracts';

/**
 * Board geometry in tile units: a tile is 2 long and 1 wide. The first tile
 * sits at (0, 0); the right arm grows to the right and snakes down, the left
 * arm grows to the left and snakes up, so the line never leaves a band of
 * `halfWidth` units on each side of the center.
 */
export interface LaidTile {
  /** Index in the line (left end = 0). */
  index: number;
  x: number;
  y: number;
  /** Long side vertical (crossed doubles and corner tiles). */
  vertical: boolean;
  /** Pips on the left half (or top half when vertical) and on the other half. */
  first: number;
  second: number;
  seat: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface BoardLayout {
  tiles: LaidTile[];
  /** Where the next tile goes on each end; null before the first tile. */
  ends: { left: Point; right: Point } | null;
  box: { minX: number; minY: number; maxX: number; maxY: number };
}

interface Arm {
  /** Edge where the next tile attaches. */
  x: number;
  /** Center of the current row. */
  y: number;
  /** Horizontal direction of the current row. */
  dir: 1 | -1;
  /** Where the arm turns to: down (right arm) or up (left arm). */
  vdir: 1 | -1;
  /** The last tile turned a corner: the next one never crosses (it would overlap it). */
  cornered: boolean;
}

/** Lays out one arm, from the tile next to the origin outwards. Returns where its open end is. */
function walk(arm: Arm, tiles: { placed: DominoPlaced; index: number; inner: number; outer: number }[], halfWidth: number, out: LaidTile[]): Point {
  for (const { placed, index, inner, outer } of tiles) {
    const double = inner === outer;
    const crossed = double && !arm.cornered;
    const width = crossed ? 1 : 2;
    if (Math.abs(arm.x + arm.dir * width) > halfWidth) {
      // Corner: a vertical tile, its inner half on this row, then the next row runs back.
      const cx = arm.x + arm.dir * 0.5;
      out.push({
        index,
        x: cx,
        y: arm.y + arm.vdir * 0.5,
        vertical: true,
        first: arm.vdir === 1 ? inner : outer,
        second: arm.vdir === 1 ? outer : inner,
        seat: placed.seat,
      });
      arm.y += arm.vdir * 2;
      arm.x = cx + arm.dir * 0.5;
      arm.dir = arm.dir === 1 ? -1 : 1;
      arm.cornered = true;
      continue;
    }
    if (crossed) out.push({ index, x: arm.x + arm.dir * 0.5, y: arm.y, vertical: true, first: inner, second: outer, seat: placed.seat });
    else
      out.push({
        index,
        x: arm.x + arm.dir,
        y: arm.y,
        vertical: false,
        first: arm.dir === 1 ? inner : outer,
        second: arm.dir === 1 ? outer : inner,
        seat: placed.seat,
      });
    arm.x += arm.dir * width;
    arm.cornered = false;
  }
  return { x: arm.x + arm.dir * 0.6, y: arm.y };
}

export function layoutLine(line: readonly DominoPlaced[], origin: number, halfWidth: number): BoardLayout {
  const tiles: LaidTile[] = [];
  if (line.length === 0) return { tiles, ends: null, box: { minX: -halfWidth, minY: -1, maxX: halfWidth, maxY: 1 } };
  const first = line[origin];
  const double = first.a === first.b;
  tiles.push({ index: origin, x: 0, y: 0, vertical: double, first: first.a, second: first.b, seat: first.seat });
  const reach = double ? 0.5 : 1;
  const right = walk(
    { x: reach, y: 0, dir: 1, vdir: 1, cornered: false },
    line.slice(origin + 1).map((placed, i) => ({ placed, index: origin + 1 + i, inner: placed.a, outer: placed.b })),
    halfWidth,
    tiles,
  );
  const left = walk(
    { x: -reach, y: 0, dir: -1, vdir: -1, cornered: false },
    line
      .slice(0, origin)
      .map((placed, index) => ({ placed, index, inner: placed.b, outer: placed.a }))
      .reverse(),
    halfWidth,
    tiles,
  );
  const box = { minX: Math.min(left.x, right.x) - 0.5, minY: Math.min(left.y, right.y) - 0.5, maxX: Math.max(left.x, right.x) + 0.5, maxY: Math.max(left.y, right.y) + 0.5 };
  for (const t of tiles) {
    const hw = t.vertical ? 0.5 : 1;
    const hh = t.vertical ? 1 : 0.5;
    box.minX = Math.min(box.minX, t.x - hw);
    box.maxX = Math.max(box.maxX, t.x + hw);
    box.minY = Math.min(box.minY, t.y - hh);
    box.maxY = Math.max(box.maxY, t.y + hh);
  }
  return { tiles, ends: { left, right }, box };
}

/** How wide each arm may grow for a board area of this aspect ratio (width / height). */
export function halfWidthFor(aspect: number): number {
  return Math.max(3, Math.min(9, Math.round(aspect * 3.6 * 2) / 2));
}

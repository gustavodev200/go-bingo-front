import type { DominoPlaced } from '@/contracts';
import { halfWidthFor, layoutLine, type LaidTile } from './board-layout';

/** A legal line built greedily from the whole set, growing both ends in turns. */
function longLine(seed: number): { line: DominoPlaced[]; origin: number } {
  const pool: [number, number][] = [];
  for (let a = 0; a <= 6; a++) for (let b = a; b <= 6; b++) pool.push([a, b]);
  let n = seed;
  const take = (i: number) => pool.splice(i, 1)[0];
  const [a, b] = take(n % pool.length);
  const line: DominoPlaced[] = [{ a, b, seat: 0 }];
  let origin = 0;
  for (let step = 0; step < 60 && pool.length; step++) {
    n = (n * 31 + 7) % 997;
    const left = step % 2 === 0;
    const end = left ? line[0].a : line[line.length - 1].b;
    const i = pool.findIndex(([x, y]) => x === end || y === end);
    if (i < 0) continue;
    const [x, y] = take(i);
    if (left) {
      line.unshift(y === end ? { a: x, b: y, seat: 1 } : { a: y, b: x, seat: 1 });
      origin++;
    } else line.push(x === end ? { a: x, b: y, seat: 2 } : { a: y, b: x, seat: 2 });
  }
  return { line, origin };
}

const rect = (t: LaidTile) => {
  const hw = t.vertical ? 0.5 : 1;
  const hh = t.vertical ? 1 : 0.5;
  return { x0: t.x - hw, x1: t.x + hw, y0: t.y - hh, y1: t.y + hh };
};

const overlaps = (p: LaidTile, q: LaidTile) => {
  const a = rect(p);
  const b = rect(q);
  const e = 1e-9;
  return a.x0 < b.x1 - e && b.x0 < a.x1 - e && a.y0 < b.y1 - e && b.y0 < a.y1 - e;
};

describe('layoutLine', () => {
  it('has nothing to draw before the first tile', () => {
    expect(layoutLine([], 0, 4)).toMatchObject({ tiles: [], ends: null });
  });

  it('puts the first tile in the middle, a crossed double, and grows both ends', () => {
    const line: DominoPlaced[] = [
      { a: 1, b: 6, seat: 1 },
      { a: 6, b: 6, seat: 0 },
      { a: 6, b: 3, seat: 2 },
    ];
    const { tiles, ends } = layoutLine(line, 1, 6);
    expect(tiles).toEqual([
      { index: 1, x: 0, y: 0, vertical: true, first: 6, second: 6, seat: 0 },
      { index: 2, x: 1.5, y: 0, vertical: false, first: 6, second: 3, seat: 2 },
      { index: 0, x: -1.5, y: 0, vertical: false, first: 1, second: 6, seat: 1 },
    ]);
    expect(ends).toEqual({ left: { x: -3.1, y: 0 }, right: { x: 3.1, y: 0 } });
  });

  it('turns a corner when an arm reaches the edge and runs back on the next row', () => {
    const line: DominoPlaced[] = [
      { a: 0, b: 1, seat: 0 },
      { a: 1, b: 2, seat: 0 },
      { a: 2, b: 3, seat: 0 },
      { a: 3, b: 4, seat: 0 },
    ];
    const { tiles } = layoutLine(line, 0, 3);
    expect(tiles[2]).toMatchObject({ index: 2, x: 3.5, y: 0.5, vertical: true, first: 2, second: 3 });
    // Back to the left on the row below, its inner half under the corner's outer half.
    expect(tiles[3]).toMatchObject({ index: 3, x: 3, y: 2, vertical: false, first: 4, second: 3 });
  });

  it.each([3, 4, 5, 6, 7, 8, 9])('never overlaps tiles and keeps inside the band (half width %i)', (halfWidth) => {
    for (const seed of [0, 5, 11, 19, 27]) {
      const { line, origin } = longLine(seed);
      const { tiles, box } = layoutLine(line, origin, halfWidth);
      expect(tiles).toHaveLength(line.length);
      for (let i = 0; i < tiles.length; i++) {
        expect(Math.abs(tiles[i].x)).toBeLessThanOrEqual(halfWidth + 1);
        for (let j = i + 1; j < tiles.length; j++) expect(overlaps(tiles[i], tiles[j])).toBe(false);
      }
      expect(box.maxX - box.minX).toBeLessThanOrEqual(2 * halfWidth + 3);
    }
  });

  it('picks a narrower band for portrait boards', () => {
    expect(halfWidthFor(0.5)).toBe(3);
    expect(halfWidthFor(1.5)).toBe(5.5);
    expect(halfWidthFor(4)).toBe(9);
  });
});

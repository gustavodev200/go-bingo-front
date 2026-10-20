import { DAMAS_INITIAL_BOARD, type DamasMove } from '@/contracts';
import { candidates, capturedBy, nextTargets, onlyMovable, pendingCaptures, screenOrder, tap } from './board-logic';

const double: DamasMove = { from: 40, path: [26, 12], captures: [33, 19] };
const otherDouble: DamasMove = { from: 40, path: [26, 8], captures: [33, 17] };
const step: DamasMove[] = [
  { from: 40, path: [33], captures: [] },
  { from: 42, path: [33], captures: [] },
  { from: 42, path: [35], captures: [] },
];

describe('board logic', () => {
  it('turns the board around for black', () => {
    expect(screenOrder('white')[0]).toBe(0);
    expect(screenOrder('black')[0]).toBe(63);
  });

  it('counts captured pieces from the board', () => {
    expect(capturedBy(DAMAS_INITIAL_BOARD)).toEqual({ white: 0, black: 0 });
    expect(capturedBy(DAMAS_INITIAL_BOARD.replace('b', '.').replace('b', '.'))).toEqual({ white: 2, black: 0 });
  });

  it('selects a piece, then plays a simple move on the target', () => {
    const first = tap(step, null, 42);
    expect(first).toEqual({ kind: 'select', selection: { from: 42, path: [] } });
    if (first.kind !== 'select') throw new Error('expected a selection');
    expect([...nextTargets(step, first.selection!)].sort()).toEqual([33, 35]);
    expect(tap(step, first.selection, 35)).toEqual({ kind: 'move', move: step[2] });
  });

  it('switches or drops the selection', () => {
    expect(tap(step, { from: 42, path: [] }, 40)).toEqual({ kind: 'select', selection: { from: 40, path: [] } });
    expect(tap(step, { from: 42, path: [] }, 42)).toEqual({ kind: 'select', selection: null });
    expect(tap(step, { from: 42, path: [] }, 0)).toEqual({ kind: 'select', selection: null });
  });

  it('walks a multi-capture one jump at a time', () => {
    const moves = [double, otherDouble];
    const mid = tap(moves, { from: 40, path: [] }, 26);
    expect(mid).toEqual({ kind: 'select', selection: { from: 40, path: [26] } });
    if (mid.kind !== 'select') throw new Error('expected a selection');
    expect(candidates(moves, mid.selection!)).toHaveLength(2);
    expect([...pendingCaptures(moves, mid.selection!)]).toEqual([33]);
    expect(tap(moves, mid.selection, 8)).toEqual({ kind: 'move', move: otherDouble });
  });

  it('preselects the only piece that can move', () => {
    expect(onlyMovable([double, otherDouble])).toBe(40);
    expect(onlyMovable(step)).toBeNull();
  });
});

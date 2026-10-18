import { memo, type CSSProperties } from 'react';
import type { DominoTile } from '@/contracts';
import { cn } from '@/lib/utils';
import styles from './domino.module.css';

const D = 0.25;
/** Pip centers inside a 1×1 half, for a horizontal tile (the 6 is 2 rows of 3; rotated it reads as 2 columns). */
const PIPS: readonly (readonly [number, number])[][] = [
  [],
  [[0, 0]],
  [
    [-D, -D],
    [D, D],
  ],
  [
    [-D, -D],
    [0, 0],
    [D, D],
  ],
  [
    [-D, -D],
    [D, -D],
    [-D, D],
    [D, D],
  ],
  [
    [-D, -D],
    [D, -D],
    [0, 0],
    [-D, D],
    [D, D],
  ],
  [
    [-D, -D],
    [0, -D],
    [D, -D],
    [-D, D],
    [0, D],
    [D, D],
  ],
];

/** A tile centered at the origin, lying horizontally (2 × 1); `first` is the left half. Gap keeps neighbours apart. */
export const TileFace = memo(function TileFace({ first, second }: { first: number; second: number }) {
  return (
    <>
      <rect x={-0.96} y={-0.46} width={1.92} height={0.92} rx={0.13} className={styles.tileBody} />
      <line x1={0} y1={-0.33} x2={0} y2={0.33} className={styles.divider} />
      {PIPS[first].map(([x, y], i) => (
        <circle key={`f${i}`} cx={x - 0.48} cy={y} r={0.085} className={styles.pip} />
      ))}
      {PIPS[second].map(([x, y], i) => (
        <circle key={`s${i}`} cx={x + 0.48} cy={y} r={0.085} className={styles.pip} />
      ))}
    </>
  );
});

/** The back of a tile (hidden hands). */
export function TileBack() {
  return (
    <>
      <rect x={-0.96} y={-0.46} width={1.92} height={0.92} rx={0.13} className={styles.tileBack} />
      <circle cx={0} cy={0} r={0.14} fill="#f59e0b" opacity={0.85} />
    </>
  );
}

/** A standalone tile (hand, art). Upright by default, `tile: null` shows its back. */
export const DominoTileView = memo(function DominoTileView({
  tile,
  horizontal = false,
  className,
  style,
  label,
}: {
  tile: DominoTile | null;
  horizontal?: boolean;
  className?: string;
  style?: CSSProperties;
  label?: string;
}) {
  return (
    <svg
      viewBox={horizontal ? '-1 -0.5 2 1' : '-0.5 -1 1 2'}
      className={cn('block drop-shadow-[0_2px_2px_rgb(0_0_0/0.45)]', horizontal ? 'aspect-[2/1]' : 'aspect-[1/2]', className)}
      style={style}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <g transform={horizontal ? undefined : 'rotate(90)'}>{tile ? <TileFace first={tile.a} second={tile.b} /> : <TileBack />}</g>
    </svg>
  );
});

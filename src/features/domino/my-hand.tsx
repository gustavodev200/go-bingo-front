'use client';

import type { DominoHandTile, DominoSide } from '@/contracts';
import { cn } from '@/lib/utils';
import { DominoTileView } from './domino-tile';
import { tileLabel } from './rules-view';
import styles from './domino.module.css';

/**
 * My tiles standing in a row (wrapping when the hand grows). On my turn the
 * tiles that fit rise and the others dim; the selected one glows while I
 * pick an end.
 */
export function MyHand({
  tiles,
  playable,
  myTurn,
  selected,
  onTap,
}: {
  tiles: DominoHandTile[];
  playable: ReadonlyMap<string, DominoSide[]>;
  myTurn: boolean;
  selected: string | null;
  onTap(tile: DominoHandTile): void;
}) {
  return (
    <ul aria-label="Suas peças" className="flex flex-wrap items-end justify-center gap-[clamp(3px,1vw,8px)] px-1 pt-4 pb-1">
      {tiles.map((t, i) => {
        const canPlay = playable.has(t.id);
        return (
          <li key={t.id} className={styles.deal} style={{ animationDelay: `${Math.min(i, 10) * 35}ms` }}>
            <button
              type="button"
              disabled={!canPlay}
              aria-pressed={selected === t.id}
              onClick={() => onTap(t)}
              aria-label={`Jogar ${tileLabel(t.tile)}`}
              className={cn(
                'block rounded-[12%] transition duration-200 outline-none focus-visible:ring-4 focus-visible:ring-amber-300 disabled:cursor-default',
                canPlay && '-translate-y-2.5 cursor-pointer hover:-translate-y-4',
                selected === t.id && '-translate-y-5 ring-4 ring-amber-300',
                myTurn && !canPlay && 'opacity-55 saturate-50',
              )}
            >
              <DominoTileView tile={t.tile} className="w-[clamp(26px,min(8.5vw,6.2dvh),48px)]" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

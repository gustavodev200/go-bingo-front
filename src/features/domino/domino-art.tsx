import { DominoTileView } from './domino-tile';
import styles from './domino.module.css';

/** Dominó illustration: a short line with a crossed double on the felt. Decorative. */
export function DominoArt() {
  return (
    <div aria-hidden className={`relative flex h-full items-center justify-center ${styles.backdrop}`}>
      <div className="flex items-center transition-transform duration-500 group-hover:scale-110 motion-reduce:transition-none">
        <DominoTileView tile={{ a: 2, b: 6 }} horizontal className="w-14 -rotate-6" />
        <DominoTileView tile={{ a: 6, b: 6 }} className="-mx-0.5 w-7" />
        <DominoTileView tile={{ a: 6, b: 4 }} horizontal className="w-14" />
        <DominoTileView tile={{ a: 4, b: 1 }} className="-ml-0.5 w-7 translate-y-5" />
      </div>
      <span className="font-display absolute right-4 bottom-3 -rotate-6 rounded-xl border-2 border-white bg-stone-900 px-2 text-lg font-black text-amber-200 shadow-lg">BATI!</span>
    </div>
  );
}

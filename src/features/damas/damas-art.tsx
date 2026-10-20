import { PieceView } from './board';
import styles from './damas.module.css';

const PIECES: Record<number, 'w' | 'b' | 'W' | 'B'> = { 1: 'b', 3: 'b', 6: 'b', 10: 'w', 13: 'B', 15: 'w', 18: 'w', 20: 'W' };

/** Damas illustration: a corner of the board mid-game, with a crowned king. Decorative. */
export function DamasArt() {
  return (
    <div aria-hidden className={`relative flex h-full items-center justify-center ${styles.backdrop}`}>
      <div className="w-32 -rotate-6 transition-transform duration-500 group-hover:scale-110 motion-reduce:transition-none">
        <div className={`${styles.board} [padding:5px]`}>
          <div className="grid grid-cols-6 overflow-hidden rounded-sm">
            {Array.from({ length: 24 }, (_, i) => {
              const dark = (Math.floor(i / 6) + (i % 6)) % 2 === 1;
              const piece = PIECES[i];
              return (
                <span key={i} className={`relative aspect-square ${styles.cell} ${dark ? styles.dark : styles.light}`}>
                  {piece && <PieceView cell={piece} />}
                </span>
              );
            })}
          </div>
        </div>
      </div>
      <span className="font-display absolute right-4 bottom-3 -rotate-6 rounded-xl border-2 border-white bg-stone-900 px-2 text-lg font-black text-amber-200 shadow-lg">DAMA!</span>
    </div>
  );
}

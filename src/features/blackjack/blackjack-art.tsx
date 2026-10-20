import { PlayingCard } from './playing-card';
import styles from './blackjack.module.css';

/** Blackjack illustration: an ace and a king fanned on the felt, with a chip. Decorative. */
export function BlackjackArt() {
  return (
    <div aria-hidden className={`relative flex h-full items-center justify-center ${styles.backdrop}`}>
      <div className="flex items-end transition-transform duration-500 group-hover:scale-110 motion-reduce:transition-none">
        <PlayingCard card="AS" size="md" className="-rotate-12" style={{ width: 64 }} />
        <PlayingCard card="KH" size="md" className="-ml-6 rotate-6" style={{ width: 64 }} />
        <span className={`${styles.chip} ${styles.chip100} -ml-3 w-10 text-xs`}>
          <span className="relative z-1">100</span>
        </span>
      </div>
      <span className="font-display absolute right-4 bottom-3 -rotate-6 rounded-xl border-2 border-white bg-emerald-950 px-2 text-lg font-black text-amber-200 shadow-lg">21!</span>
    </div>
  );
}

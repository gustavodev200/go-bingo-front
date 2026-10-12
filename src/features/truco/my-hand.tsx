'use client';

import type { TrucoHandCard } from '@/contracts';
import { cn } from '@/lib/utils';
import { useBusy } from './action-bar';
import { cardLabel, PlayingCard } from './playing-card';
import styles from './truco.module.css';

/** The player's own cards, fanned at the bottom. Tapping plays a card when it is their turn. */
export function MyHand({ cards, canPlay, onPlay }: { cards: TrucoHandCard[]; canPlay: boolean; onPlay(cardId: string): Promise<unknown> }) {
  const { busy, run } = useBusy();
  const mid = (cards.length - 1) / 2;
  return (
    <ul aria-label="Suas cartas" className="flex items-end justify-center">
      {cards.map((c, i) => {
        const tilt = (i - mid) * 7;
        return (
          <li key={c.id} className="-mx-1 sm:mx-0.5" style={{ transform: `rotate(${tilt}deg) translateY(${Math.abs(i - mid) * 6}px)` }}>
            <button
              type="button"
              disabled={!canPlay || busy}
              onClick={run(() => onPlay(c.id))}
              aria-label={c.card ? `Jogar ${cardLabel(c.card)}` : `Jogar carta oculta ${i + 1}`}
              className={cn('block rounded-[9%] transition-transform duration-200 outline-none focus-visible:ring-4 focus-visible:ring-amber-300', styles.deal, canPlay ? 'cursor-pointer hover:-translate-y-4 focus-visible:-translate-y-4' : 'cursor-not-allowed')}
              style={{ animationDelay: `${i * 90}ms` }}
            >
              <PlayingCard card={c.card} size="lg" dim={!canPlay} backMark="?" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

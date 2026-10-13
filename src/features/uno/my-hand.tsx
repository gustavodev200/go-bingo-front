'use client';

import type { UnoHandCard } from '@/contracts';
import { cn } from '@/lib/utils';
import { cardLabel } from './rules-view';
import { UnoCardView } from './uno-card';
import styles from './uno.module.css';

/**
 * My cards in a fan. Playable cards rise (and the one just drawn glows); the
 * rest dim on my turn. The overlap grows with the hand so it always fits.
 */
export function MyHand({ cards, playable, drawnId, myTurn, onPlay }: { cards: UnoHandCard[]; playable: ReadonlySet<string>; drawnId: string | null; myTurn: boolean; onPlay(card: UnoHandCard): void }) {
  const n = cards.length;
  const overlap = n <= 5 ? '-0.4rem' : n <= 8 ? '-1.6rem' : n <= 12 ? '-2.4rem' : '-2.9rem';
  return (
    <ul aria-label="Suas cartas" className="flex justify-center px-2 pt-6 pb-1">
      {cards.map((c, i) => {
        const canPlay = playable.has(c.id);
        const angle = n > 1 ? (i - (n - 1) / 2) * Math.min(5, 40 / n) : 0;
        return (
          <li key={c.id} style={{ marginLeft: i === 0 ? 0 : overlap, zIndex: i }} className={cn('relative', styles.deal)}>
            <button
              type="button"
              disabled={!canPlay}
              onClick={() => onPlay(c)}
              aria-label={`Jogar ${cardLabel(c.card)}`}
              style={{ rotate: `${angle}deg`, translate: `0 ${Math.abs(angle) * 1.5}px` }}
              className={cn(
                'block rounded-[10%] transition duration-200 outline-none focus-visible:ring-4 focus-visible:ring-amber-300 disabled:cursor-default',
                canPlay && '-translate-y-4 cursor-pointer hover:-translate-y-7 hover:scale-105',
                c.id === drawnId && 'ring-4 ring-amber-300',
              )}
            >
              <UnoCardView card={c.card} size="lg" dim={myTurn && !canPlay} />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

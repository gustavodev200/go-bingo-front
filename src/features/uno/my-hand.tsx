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
  // Overlap just enough for the whole hand to fit the row (margin % = % of the row width), never less than a sliver.
  const overlap = n > 1 ? `min(-0.5rem, calc((100% - ${n} * var(--uno-hand-card)) / ${n - 1}))` : '0';
  return (
    <ul aria-label="Suas cartas" className="flex justify-center px-1 pt-6 pb-1 [--uno-hand-card:clamp(46px,min(15vw,13dvh),100px)]">
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

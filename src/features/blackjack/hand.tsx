'use client';

import type { CSSProperties } from 'react';
import { BJ_DEALER_CARD_MS, type BjDealerView, type BjHandView } from '@/contracts';
import { cn } from '@/lib/utils';
import { BetChip } from './chips';
import { CARD_WIDTH, PlayingCard, type CardSize } from './playing-card';
import { OUTCOME_LABEL, totalLabel } from './rules-view';
import styles from './blackjack.module.css';

const OUTCOME_TONE = {
  win: 'bg-emerald-400 text-emerald-950',
  blackjack: 'bg-linear-to-b from-amber-200 to-amber-400 text-amber-950',
  push: 'bg-white text-slate-900',
  lose: 'bg-rose-600 text-white',
  surrender: 'bg-slate-300 text-slate-900',
} as const;

/** Total bubble: green on 21, red when bust. */
function TotalBadge({ hand, compact }: { hand: BjHandView; compact: boolean }) {
  const bust = hand.status === 'bust';
  const top = hand.total === 21 || hand.status === 'blackjack';
  return (
    <span
      className={cn(
        'rounded-full px-2 py-0.5 text-xs font-black whitespace-nowrap tabular-nums shadow ring-1 ring-black/20',
        bust ? 'bg-rose-600 text-white' : top ? 'bg-emerald-400 text-emerald-950' : 'bg-slate-950/80 text-white',
      )}
    >
      {bust ? (compact ? `${hand.total} ✕` : `${hand.total} estourou`) : totalLabel(hand)}
    </span>
  );
}

/** Cards fanned out; new cards slide in from the shoe (keys are stable, so only new ones animate). */
export function CardFan({ cards, size, overlap = 0.55, delayOf }: { cards: (BjHandView['cards'][number] | null)[]; size: CardSize; overlap?: number; delayOf?(index: number): number }) {
  return (
    <span className={cn('flex items-end', styles.fan)} style={{ '--card-w': CARD_WIDTH[size], '--overlap': overlap } as CSSProperties}>
      {cards.map((card, i) => (
        <PlayingCard
          key={`${i}-${card ?? 'back'}`}
          card={card}
          size={size}
          className={card ? (i === 1 && delayOf ? styles.flip : styles.dealt) : styles.dealt}
          style={{ animationDelay: `${delayOf?.(i) ?? 0}ms` }}
        />
      ))}
    </span>
  );
}

/** One player hand: cards, total, the bet on it and, once the round closes, the outcome. */
export function HandView({
  hand,
  size,
  active,
  revealDelay = 0,
  label,
  compact = false,
}: {
  hand: BjHandView;
  size: CardSize;
  active: boolean;
  revealDelay?: number;
  label: string;
  compact?: boolean;
}) {
  const outcome = hand.outcome && (
    <span
      className={cn(
        'rounded-full px-2 py-0.5 font-black whitespace-nowrap uppercase shadow-lg',
        compact ? 'text-[10px]' : 'absolute -top-2 left-1/2 z-10 -translate-x-1/2 text-[11px]',
        OUTCOME_TONE[hand.outcome],
        styles.pop,
      )}
      style={{ animationDelay: `${revealDelay}ms` }}
    >
      {OUTCOME_LABEL[hand.outcome]}
      {hand.net !== 0 && ` ${hand.net > 0 ? '+' : '−'}${Math.abs(hand.net)}`}
    </span>
  );
  return (
    <div
      role="group"
      aria-label={`${label}: ${hand.total}${hand.outcome ? `, ${OUTCOME_LABEL[hand.outcome]}` : ''}`}
      className={cn('relative flex flex-col items-center gap-1 rounded-2xl p-1 transition', active && 'bg-amber-300/15 ring-2 ring-amber-300', hand.status === 'surrendered' && 'opacity-60')}
    >
      <CardFan cards={hand.cards} size={size} />
      <span className="flex items-center gap-1">
        <TotalBadge hand={hand} compact={compact} />
        <BetChip amount={hand.bet} />
      </span>
      {outcome}
    </div>
  );
}

/** Delay for the dealer's card `i` once the hole card turns: the draws come one after another. */
export const dealerDelay = (i: number) => (i < 2 ? 0 : (i - 1) * BJ_DEALER_CARD_MS);

/** The dealer: up card, hole card (face down until it plays) and the visible total. */
export function DealerView({ dealer, size }: { dealer: BjDealerView; size: CardSize }) {
  const hidden = dealer.cards.includes(null);
  const drew = Math.max(0, dealer.cards.length - 2);
  return (
    <div className="flex flex-col items-center gap-1" role="group" aria-label={`Dealer: ${dealer.blackjack ? 'blackjack' : dealer.total}${hidden ? ', uma carta virada' : ''}`}>
      <CardFan cards={dealer.cards} size={size} overlap={0.4} delayOf={hidden ? undefined : dealerDelay} />
      {dealer.cards.length > 0 && (
        <span
          className={cn(
            'rounded-full px-2.5 py-0.5 text-xs font-black tabular-nums shadow ring-1 ring-black/20',
            dealer.total > 21 ? 'bg-rose-600 text-white' : dealer.blackjack ? 'bg-amber-300 text-amber-950' : 'bg-slate-950/80 text-white',
            !hidden && styles.pop,
          )}
          style={{ animationDelay: `${hidden ? 0 : drew * BJ_DEALER_CARD_MS}ms` }}
        >
          {dealer.blackjack ? 'Blackjack' : dealer.total > 21 ? `${dealer.total} estourou` : hidden ? `${dealer.total} + ?` : dealer.total}
        </span>
      )}
    </div>
  );
}

import { memo, type CSSProperties } from 'react';
import { bjRank, bjSuit, type BjCard, type BjSuit } from '@/contracts';
import { cn } from '@/lib/utils';
import styles from './blackjack.module.css';

export const SUIT_SYMBOL: Record<BjSuit, string> = { S: '♠', H: '♥', D: '♦', C: '♣' };
const SUIT_NAME: Record<BjSuit, string> = { S: 'espadas', H: 'copas', D: 'ouros', C: 'paus' };
const RANK_NAME: Record<string, string> = { A: 'Ás', T: '10', J: 'Valete', Q: 'Dama', K: 'Rei' };

export const rankText = (card: BjCard) => (bjRank(card) === 'T' ? '10' : bjRank(card));
export const cardLabel = (card: BjCard) => `${RANK_NAME[bjRank(card)] ?? bjRank(card)} de ${SUIT_NAME[bjSuit(card)]}`;

export const CARD_WIDTH = {
  // min(vw, dvh) keeps the cards inside short landscape phones too.
  xs: 'clamp(22px, min(6.5vw, 4.2dvh), 36px)',
  sm: 'clamp(30px, min(9vw, 6.4dvh), 54px)',
  md: 'clamp(46px, min(15vw, 9dvh), 92px)',
} as const;
export type CardSize = keyof typeof CARD_WIDTH;

/**
 * One playing card. `card = null` is a face-down card (the dealer's hole card).
 * Memoised: a hand re-renders on every table update but its cards never change.
 */
export const PlayingCard = memo(function PlayingCard({ card, size = 'md', className, style }: { card: BjCard | null; size?: CardSize; className?: string; style?: CSSProperties }) {
  const sized: CSSProperties = { width: CARD_WIDTH[size], ...style };
  if (!card) return <span aria-label="Carta virada" role="img" style={sized} className={cn(styles.card, styles.back, className)} />;
  const red = bjSuit(card) === 'H' || bjSuit(card) === 'D';
  const color = red ? 'text-rose-600' : 'text-slate-900';
  const rank = rankText(card);
  const suit = SUIT_SYMBOL[bjSuit(card)];
  return (
    <span role="img" aria-label={cardLabel(card)} style={sized} className={cn(styles.card, styles.face, 'flex', color, className)}>
      <span className={cn('absolute top-[5%] left-[8%] flex flex-col items-center leading-none font-black', rank === '10' && 'tracking-[-0.08em]')}>
        <span className="text-[30cqi]">{rank}</span>
        <span className="text-[24cqi]">{suit}</span>
      </span>
      <span className="absolute right-[8%] bottom-[6%] text-[48cqi] leading-none">{suit}</span>
    </span>
  );
});

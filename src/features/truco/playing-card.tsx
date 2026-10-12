import type { CSSProperties } from 'react';
import { manilhaName, type TrucoCard } from '@/contracts';
import { cn } from '@/lib/utils';
import styles from './truco.module.css';

export const SUIT_SYMBOL: Record<TrucoCard['suit'], string> = { clubs: '♣', hearts: '♥', spades: '♠', diamonds: '♦' };
const SUIT_NAME: Record<TrucoCard['suit'], string> = { clubs: 'paus', hearts: 'copas', spades: 'espadas', diamonds: 'ouros' };
const RANK_NAME: Record<TrucoCard['rank'], string> = { A: 'Ás', K: 'Rei', J: 'Valete', Q: 'Dama', '2': '2', '3': '3', '4': '4', '5': '5', '6': '6', '7': '7' };

export function cardLabel(card: TrucoCard): string {
  const name = `${RANK_NAME[card.rank]} de ${SUIT_NAME[card.suit]}`;
  const manilha = manilhaName(card);
  return manilha ? `${name} (${manilha})` : name;
}

const SIZES = {
  // min(vw, dvh) keeps cards inside short landscape phones too.
  xs: 'w-[clamp(16px,min(4.5vw,4dvh),26px)]',
  sm: 'w-[clamp(30px,min(9vw,7dvh),52px)]',
  md: 'w-[clamp(40px,min(13vw,11dvh),80px)]',
  lg: 'w-[clamp(52px,min(21vw,15dvh),112px)]',
} as const;

/**
 * A 2D playing card. `card = null` shows the back (an opponent's card or a blind
 * card in the mão de ferro). Text scales with the card through container units.
 */
export function PlayingCard({ card, size = 'md', highlight = false, dim = false, backMark = 'GU', className, style }: { card: TrucoCard | null; size?: keyof typeof SIZES; highlight?: boolean; dim?: boolean; backMark?: string; className?: string; style?: CSSProperties }) {
  const base = cn('@container relative aspect-[5/7] shrink-0 select-none rounded-[9%] shadow-[0_3px_8px_rgb(0_0_0/0.45)]', SIZES[size], className);
  if (!card) {
    return (
      <span aria-hidden style={style} className={cn(base, styles.cardBack, 'flex items-center justify-center ring-2 ring-white/80 ring-inset')}>
        <span className="font-display text-[34cqw] font-black text-amber-200/90 drop-shadow">{backMark}</span>
      </span>
    );
  }
  const red = card.suit === 'hearts' || card.suit === 'diamonds';
  const manilha = manilhaName(card);
  const color = red ? 'text-rose-600' : 'text-slate-900';
  return (
    <span
      role="img"
      aria-label={cardLabel(card)}
      style={style}
      className={cn(base, 'flex flex-col bg-linear-to-br from-white to-stone-100', manilha && 'ring-[clamp(2px,3cqw,4px)] ring-amber-400', highlight && 'ring-4 ring-emerald-400 shadow-[0_0_24px_rgb(52_211_153/0.8)]', dim && 'opacity-55 saturate-50')}
    >
      <span className={cn('absolute top-[4%] left-[8%] flex flex-col items-center leading-none font-black', color)}>
        <span className="text-[28cqw]">{card.rank}</span>
        <span className="text-[22cqw]">{SUIT_SYMBOL[card.suit]}</span>
      </span>
      <span className={cn('absolute inset-0 flex items-center justify-center text-[58cqw] leading-none', color)}>{SUIT_SYMBOL[card.suit]}</span>
      <span className={cn('absolute right-[8%] bottom-[4%] flex rotate-180 flex-col items-center leading-none font-black', color)}>
        <span className="text-[28cqw]">{card.rank}</span>
        <span className="text-[22cqw]">{SUIT_SYMBOL[card.suit]}</span>
      </span>
      {manilha && (
        <span className="absolute inset-x-[6%] bottom-[-7%] rounded-full bg-linear-to-b from-amber-300 to-amber-500 py-[2%] text-center text-[15cqw] font-black tracking-wide text-amber-950 uppercase shadow">{manilha}</span>
      )}
    </span>
  );
}

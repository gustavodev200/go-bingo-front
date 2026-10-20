import { memo, type CSSProperties } from 'react';
import { gaudManilhaName, type GaudCard, type GaudSuit } from '@/contracts';
import { cn } from '@/lib/utils';
import styles from './gauderio.module.css';

export const SUIT_NAME: Record<GaudSuit, string> = { espadas: 'espadas', paus: 'paus', copas: 'copas', ouros: 'ouros' };
const FIGURE: Partial<Record<number, string>> = { 1: 'Ás', 10: 'Sota', 11: 'Cavalo', 12: 'Rei' };

export function cardLabel(card: GaudCard): string {
  const name = `${FIGURE[card.rank] ?? card.rank} de ${SUIT_NAME[card.suit]}`;
  const manilha = gaudManilhaName(card);
  return manilha && card.rank === 1 ? `${name} (${manilha})` : name;
}

const SUIT_COLOR: Record<GaudSuit, string> = { espadas: 'text-sky-700', paus: 'text-emerald-800', copas: 'text-rose-700', ouros: 'text-amber-600' };

/** Os quatro naipes do baralho espanhol desenhados em SVG (escala com a carta). */
export function SuitIcon({ suit, className }: { suit: GaudSuit; className?: string }) {
  switch (suit) {
    case 'ouros':
      return (
        <svg viewBox="0 0 24 24" aria-hidden className={className}>
          <circle cx="12" cy="12" r="10.5" fill="#fbbf24" stroke="#b45309" strokeWidth="1.5" />
          <circle cx="12" cy="12" r="6.5" fill="#fde68a" stroke="#d97706" strokeWidth="1" />
          <path d="M12 7.5l1.3 3 3.2.3-2.4 2.1.7 3.1L12 14.4 9.2 16l.7-3.1-2.4-2.1 3.2-.3z" fill="#d97706" />
        </svg>
      );
    case 'copas':
      return (
        <svg viewBox="0 0 24 24" aria-hidden className={className}>
          <path d="M4 3h16c0 6-3.2 9.4-6.3 10.2V17h3.3v1.8H7v-1.8h3.3v-3.8C7.2 12.4 4 9 4 3z" fill="#dc2626" stroke="#7f1d1d" strokeWidth="1" strokeLinejoin="round" />
          <path d="M4.6 5.2h14.8" stroke="#fbbf24" strokeWidth="1.6" />
          <rect x="6" y="19" width="12" height="2.4" rx="1" fill="#fbbf24" stroke="#92400e" strokeWidth=".8" />
        </svg>
      );
    case 'espadas':
      return (
        <svg viewBox="0 0 24 24" aria-hidden className={className}>
          <path d="M12 1.5l1.6 2.2v12.3h-3.2V3.7z" fill="#60a5fa" stroke="#1e3a8a" strokeWidth=".9" strokeLinejoin="round" />
          <path d="M6.5 16h11v1.8h-11z" fill="#fbbf24" stroke="#92400e" strokeWidth=".8" />
          <path d="M11 17.8h2v3.4h-2z" fill="#b45309" />
          <circle cx="12" cy="22" r="1.3" fill="#fbbf24" stroke="#92400e" strokeWidth=".6" />
        </svg>
      );
    case 'paus':
      return (
        <svg viewBox="0 0 24 24" aria-hidden className={className}>
          <path d="M9.2 22.5c-.6-5 .3-12.4 1.4-19.4.2-1.4 3.4-1.4 3.6.2.6 6.8.8 13.6-.4 19.2-.4 1.4-4.4 1.4-4.6 0z" fill="#16a34a" stroke="#14532d" strokeWidth="1" />
          <path d="M10.6 7.5l-2.6-1.2M13.8 11l2.6-1.4M10.2 15l-2.4-.8" stroke="#14532d" strokeWidth="1.2" strokeLinecap="round" />
          <ellipse cx="12.3" cy="4.4" rx="1.4" ry="1" fill="#dc2626" />
        </svg>
      );
  }
}

/** Posição (% x, % y) dos naipes de 1 a 7 no centro da carta. */
const PIPS: Record<number, [number, number][]> = {
  2: [
    [50, 22],
    [50, 78],
  ],
  3: [
    [50, 18],
    [50, 50],
    [50, 82],
  ],
  4: [
    [28, 22],
    [72, 22],
    [28, 78],
    [72, 78],
  ],
  5: [
    [28, 20],
    [72, 20],
    [50, 50],
    [28, 80],
    [72, 80],
  ],
  6: [
    [28, 18],
    [72, 18],
    [28, 50],
    [72, 50],
    [28, 82],
    [72, 82],
  ],
  7: [
    [28, 16],
    [72, 16],
    [50, 33],
    [28, 52],
    [72, 52],
    [28, 84],
    [72, 84],
  ],
};

const FIGURE_ART: Record<number, string> = { 10: '🧑', 11: '🐎', 12: '👑' };

const SIZES = {
  xs: 'w-[clamp(16px,min(4.5vw,4dvh),26px)]',
  sm: 'w-[clamp(30px,min(9vw,7dvh),52px)]',
  md: 'w-[clamp(42px,min(13vw,11dvh),82px)]',
  lg: 'w-[clamp(56px,min(22vw,16dvh),118px)]',
} as const;

function CardFace({ card }: { card: GaudCard }) {
  const pips = PIPS[card.rank];
  const tilt = card.suit === 'espadas' || card.suit === 'paus';
  if (card.rank === 1)
    return (
      <span className="absolute inset-[16%_14%] flex items-center justify-center">
        <SuitIcon suit={card.suit} className={cn('h-full w-full drop-shadow', tilt && '-rotate-12')} />
      </span>
    );
  if (pips)
    return (
      <span className="absolute inset-[14%_16%]">
        {pips.map(([x, y], i) => (
          <span key={i} className="absolute -translate-1/2" style={{ left: `${x}%`, top: `${y}%`, width: card.rank >= 6 ? '34%' : '40%' }}>
            <SuitIcon suit={card.suit} className={cn('block w-full', tilt && (i % 2 ? 'rotate-12' : '-rotate-12'))} />
          </span>
        ))}
      </span>
    );
  return (
    <span className="absolute inset-[13%_12%] flex flex-col items-center justify-center gap-[4%] rounded-[8%] bg-linear-to-b from-amber-50 to-amber-100 ring-1 ring-amber-700/30">
      <span className="text-[44cqw] leading-none">{FIGURE_ART[card.rank]}</span>
      <SuitIcon suit={card.suit} className="w-[38%]" />
      <span className="text-[13cqw] font-black tracking-wide text-amber-900 uppercase">{FIGURE[card.rank]}</span>
    </span>
  );
}

/**
 * Carta do baralho espanhol em 2D. `card = null` mostra o verso (carta do
 * adversário ou carta escondida). Texto escala com a carta (container units).
 */
export const SpanishCard = memo(function SpanishCard({
  card,
  size = 'md',
  highlight = false,
  dim = false,
  className,
  style,
}: {
  card: GaudCard | null;
  size?: keyof typeof SIZES;
  highlight?: boolean;
  dim?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  const base = cn('@container relative aspect-[5/7] shrink-0 select-none rounded-[9%] shadow-[0_3px_8px_rgb(0_0_0/0.45)]', SIZES[size], className);
  if (!card)
    return (
      <span aria-hidden style={style} className={cn(base, styles.cardBack, 'flex items-center justify-center ring-2 ring-white/85 ring-inset')}>
        <span className="font-display text-[30cqw] font-black text-amber-100/90 drop-shadow">GU</span>
      </span>
    );
  const manilha = gaudManilhaName(card);
  const color = SUIT_COLOR[card.suit];
  return (
    <span
      role="img"
      aria-label={cardLabel(card)}
      style={style}
      className={cn(
        base,
        styles.face,
        manilha && 'ring-[clamp(2px,3cqw,4px)] ring-amber-400',
        highlight && 'shadow-[0_0_24px_rgb(52_211_153/0.8)] ring-4 ring-emerald-400',
        dim && 'opacity-55 saturate-50',
      )}
    >
      <span aria-hidden className="absolute inset-[4%] rounded-[7%] border-[max(1px,1.5cqw)] border-blue-700/70" />
      <span className={cn('absolute top-[3%] left-[7%] text-[22cqw] leading-none font-black', color)}>{card.rank}</span>
      <span className={cn('absolute right-[7%] bottom-[3%] rotate-180 text-[22cqw] leading-none font-black', color)}>{card.rank}</span>
      <CardFace card={card} />
      {manilha && (
        <span className="absolute inset-x-[4%] bottom-[-7%] truncate rounded-full bg-linear-to-b from-amber-300 to-amber-500 px-[4%] py-[2%] text-center text-[12cqw] font-black tracking-wide text-amber-950 uppercase shadow">
          {card.rank === 1 ? manilha : 'Manilha'}
        </span>
      )}
    </span>
  );
});

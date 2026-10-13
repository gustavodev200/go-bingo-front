'use client';

import type { UnoColor, UnoRoundView } from '@/contracts';
import { cn } from '@/lib/utils';
import { cardLabel, COLOR_LABEL } from './rules-view';
import { COLOR_HEX, UnoCardView } from './uno-card';
import styles from './uno.module.css';

/** Small fixed tilt per discard, so the pile looks thrown and not stacked. */
const tilt = (n: number) => ((n * 37) % 30) - 15;

/** Draw pile, discard pile, current color ring and play direction, in the middle of the table. */
export function TableCenter({ round, canDraw, onDraw }: { round: UnoRoundView; canDraw: boolean; onDraw(): void }) {
  const color: UnoColor = round.color;
  const under = Math.min(round.discardCount - 1, 3);
  return (
    <div className="absolute top-[52%] left-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center" style={{ '--uno-color': COLOR_HEX[color] } as React.CSSProperties}>
      <div aria-hidden className={cn('absolute size-[min(62cqw,58cqh)]', styles.ring)} />
      <svg aria-hidden viewBox="0 0 100 100" className={cn('absolute size-[min(70cqw,66cqh)]', round.direction === 1 ? styles.arrows : styles.arrowsReverse)}>
        {[0, 120, 240].map((a) => (
          <g key={a} transform={`rotate(${a} 50 50)`}>
            <path d="M50 3 A47 47 0 0 1 85 18" fill="none" stroke="rgb(255 255 255 / 0.75)" strokeWidth="3" strokeLinecap="round" />
            <path d={round.direction === 1 ? 'M85 18 l-7 -1 l4 6 z' : 'M50 3 l6 -3 l-1 7 z'} fill="rgb(255 255 255 / 0.85)" />
          </g>
        ))}
      </svg>

      <div className="relative flex items-center gap-[clamp(14px,6cqw,48px)]">
        <button
          type="button"
          disabled={!canDraw}
          onClick={onDraw}
          aria-label={round.pendingDraw > 0 && canDraw ? `Comprar ${round.pendingDraw} do monte` : 'Comprar carta'}
          className={cn('group relative rounded-[10%] transition outline-none focus-visible:ring-4 focus-visible:ring-amber-300', canDraw && 'cursor-pointer hover:-translate-y-1', canDraw && styles.turn)}
        >
          <UnoCardView card={null} size="md" className="absolute top-1 left-1 opacity-70" />
          <UnoCardView card={null} size="md" className="absolute top-0.5 left-0.5 opacity-85" />
          <UnoCardView card={null} size="md" className="relative" />
          <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs font-bold whitespace-nowrap text-white/90 tabular-nums">{round.drawPile} no monte</span>
        </button>

        <div className="relative" aria-label={`Carta da mesa: ${cardLabel(round.topCard)}`} role="img">
          {Array.from({ length: under }, (_, i) => (
            <UnoCardView key={i} card={null} size="md" className="absolute inset-0 brightness-75" style={{ rotate: `${tilt(round.discardCount - 1 - i)}deg` }} />
          ))}
          <UnoCardView
            key={round.discardCount}
            card={round.topCard}
            size="md"
            className={cn('relative', styles.land)}
            style={{ rotate: `${tilt(round.discardCount)}deg`, '--tilt': `${tilt(round.discardCount)}deg` } as React.CSSProperties}
          />
          {round.pendingDraw > 0 && (
            <span className={cn('font-display absolute -top-3 -right-4 rounded-full bg-amber-300 px-2 py-0.5 text-lg font-black text-red-700 italic shadow-lg ring-2 ring-white', styles.pulse)}>+{round.pendingDraw}</span>
          )}
        </div>
      </div>

      <span className="absolute top-[calc(50%+min(31cqw,29cqh))] left-1/2 mt-1 -translate-x-1/2 rounded-full px-3 py-0.5 text-xs font-black whitespace-nowrap text-white shadow ring-2 ring-white/70" style={{ background: COLOR_HEX[color] }} role="status">
        Cor: {COLOR_LABEL[color]} · {round.direction === 1 ? '↻ horário' : '↺ anti-horário'}
      </span>
    </div>
  );
}

'use client';

import { EyeOff } from 'lucide-react';
import { useState } from 'react';
import type { GaudHandCard } from '@/contracts';
import { useBusy } from '@/features/truco/action-bar';
import trucoStyles from '@/features/truco/truco.module.css';
import { cn } from '@/lib/utils';
import { cardLabel, SpanishCard } from './spanish-card';

/** Minhas cartas em leque. Tocar joga na minha vez; com "esconder" ligado a carta vai virada. */
export function MyHand({
  cards,
  canPlay,
  canHide,
  envido,
  onPlay,
}: {
  cards: GaudHandCard[];
  canPlay: boolean;
  canHide: boolean;
  envido: number;
  onPlay(cardId: string, hidden: boolean): Promise<unknown>;
}) {
  const { busy, run } = useBusy();
  const [hide, setHide] = useState(false);
  const hiding = hide && canHide;
  const mid = (cards.length - 1) / 2;
  return (
    <div className="flex flex-col items-center gap-1">
      <ul aria-label="Suas cartas" className="flex items-end justify-center">
        {cards.map((c, i) => {
          const tilt = (i - mid) * 7;
          return (
            <li key={c.id} className="-mx-1 sm:mx-0.5" style={{ transform: `rotate(${tilt}deg) translateY(${Math.abs(i - mid) * 6}px)` }}>
              <button
                type="button"
                disabled={!canPlay || busy}
                onClick={run(async () => {
                  await onPlay(c.id, hiding);
                  setHide(false);
                })}
                aria-label={`${hiding ? 'Esconder' : 'Jogar'} ${cardLabel(c.card)}`}
                className={cn(
                  'block rounded-[9%] transition-transform duration-200 outline-none focus-visible:ring-4 focus-visible:ring-amber-300',
                  trucoStyles.deal,
                  canPlay ? 'cursor-pointer hover:-translate-y-4 focus-visible:-translate-y-4' : 'cursor-not-allowed',
                )}
                style={{ animationDelay: `${i * 90}ms` }}
              >
                <SpanishCard card={c.card} size="lg" dim={!canPlay} className={cn(hiding && 'ring-4 ring-slate-300')} />
              </button>
            </li>
          );
        })}
      </ul>
      <div className="flex items-center gap-2 text-xs">
        <span className="rounded-full bg-sky-950/70 px-2 py-0.5 font-bold text-sky-100 ring-1 ring-sky-400/40" title="Pontos de envido das suas 3 cartas">
          Envido: {envido}
        </span>
        {canHide && (
          <label className="flex cursor-pointer items-center gap-1 rounded-full bg-black/30 px-2 py-0.5 font-semibold text-violet-100 has-checked:bg-slate-200 has-checked:text-slate-900">
            <input type="checkbox" className="sr-only" checked={hide} onChange={(e) => setHide(e.target.checked)} />
            <EyeOff aria-hidden className="size-3.5" /> Esconder carta
          </label>
        )}
      </div>
    </div>
  );
}

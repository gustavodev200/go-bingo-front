'use client';

import { RotateCcw, X } from 'lucide-react';
import { useState } from 'react';
import { BJ_CHIP_VALUES, BJ_MAX_BET, BJ_MIN_BET } from '@/contracts';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { clampBet, fmtChips } from './rules-view';
import styles from './blackjack.module.css';

const CHIP_CLASS: Record<number, string> = { 10: styles.chip10, 50: styles.chip50, 100: styles.chip100, 500: styles.chip500 };

/** Biggest chip that fits, for showing an amount as one coloured chip. */
const chipFor = (amount: number) => [...BJ_CHIP_VALUES].reverse().find((v) => amount >= v) ?? BJ_CHIP_VALUES[0];

/** A bet on the felt: a coloured chip with the amount beside it. Decorative + the amount as text. */
export function BetChip({ amount, className }: { amount: number; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full bg-black/45 py-0.5 pr-2 pl-0.5 text-xs font-black text-amber-100 tabular-nums', styles.pop, className)}>
      <span aria-hidden className={cn(styles.chip, CHIP_CLASS[chipFor(amount)], 'w-5 text-[0px]')} />
      {fmtChips(amount)}
    </span>
  );
}

/**
 * Betting panel: tap chips to build the bet (clamped to the table limits and
 * the stack), then confirm. "Repetir" brings back the last bet.
 */
export function BetPanel({ chips, lastBet, busy, onBet }: { chips: number; lastBet: number | null; busy: boolean; onBet(amount: number): void }) {
  const [amount, setAmount] = useState(0);
  const max = Math.min(BJ_MAX_BET, chips);
  const add = (v: number) => setAmount((a) => clampBet(a + v, chips));
  const repeat = lastBet !== null ? clampBet(lastBet, chips) : null;
  return (
    <div className="flex w-full max-w-md flex-col items-center gap-2" role="group" aria-label="Aposta">
      <div className="flex items-center gap-2">
        {BJ_CHIP_VALUES.map((v) => (
          <button
            key={v}
            type="button"
            aria-label={`Somar ${v}`}
            disabled={busy || amount >= max || v > max}
            onClick={() => add(v)}
            className={cn(styles.chip, CHIP_CLASS[v], 'w-[clamp(44px,13vw,58px)] text-[clamp(11px,3.4vw,15px)] transition active:scale-90 disabled:opacity-40')}
          >
            <span className="relative z-1">{v}</span>
          </button>
        ))}
      </div>
      <div className="flex w-full items-center gap-2">
        <Button variant="secondary" size="icon" className="size-11 shrink-0 rounded-xl" aria-label="Limpar aposta" disabled={busy || amount === 0} onClick={() => setAmount(0)}>
          <X aria-hidden />
        </Button>
        {repeat !== null && (
          <Button variant="secondary" className="h-11 shrink-0 gap-1 rounded-xl px-3" disabled={busy} onClick={() => onBet(repeat)}>
            <RotateCcw aria-hidden className="size-4" /> {fmtChips(repeat)}
          </Button>
        )}
        <Button size="lg" className="h-11 flex-1 rounded-xl text-base" disabled={busy || amount < BJ_MIN_BET} onClick={() => onBet(amount)}>
          {amount < BJ_MIN_BET ? `Aposte de ${BJ_MIN_BET} a ${fmtChips(max)}` : `Apostar ${fmtChips(amount)}`}
        </Button>
      </div>
    </div>
  );
}

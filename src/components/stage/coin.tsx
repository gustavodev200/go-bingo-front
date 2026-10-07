import { cn } from '@/lib/utils';

/** Moeda dourada do jogo (decorativa). */
export function Coin({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-grid size-4 shrink-0 place-items-center rounded-full bg-[radial-gradient(circle_at_35%_30%,#fef9c3,#facc15_45%,#b45309)] text-[0.55em] font-black text-amber-900 shadow-[inset_0_0_0_1.5px_rgb(180_83_9/0.6),0_1px_2px_rgb(0_0_0/0.4)]',
        className,
      )}
    >
      $
    </span>
  );
}

/** Valor em moedas com o ícone; o texto lido é "N moedas". */
export function Coins({ amount, className, signed = false }: { amount: number; className?: string; signed?: boolean }) {
  const sign = signed && amount > 0 ? '+' : signed && amount < 0 ? '−' : '';
  return (
    <span className={cn('inline-flex items-center gap-1 font-semibold tabular-nums', className)}>
      <Coin />
      <span>
        {sign}
        {Math.abs(amount)}
        <span className="sr-only"> moedas</span>
      </span>
    </span>
  );
}

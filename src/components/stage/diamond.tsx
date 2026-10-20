import { cn } from '@/lib/utils';

/** Diamante (moeda premium, decorativo). */
export function Diamond({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 16 16" className={cn('size-4 shrink-0 drop-shadow-[0_1px_2px_rgb(0_0_0/0.4)]', className)}>
      <path d="M4 2h8l3 4-7 8-7-8z" fill="#67e8f9" />
      <path d="M1 6h14L8 14z" fill="#22d3ee" />
      <path d="M4 2l2 4h4l2-4M6 6l2 8 2-8" fill="none" stroke="#ecfeff" strokeWidth=".8" strokeLinejoin="round" opacity=".8" />
    </svg>
  );
}

/** Valor em diamantes com o ícone; o texto lido é "N diamantes". */
export function Diamonds({ amount, className }: { amount: number; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 font-semibold tabular-nums', className)}>
      <Diamond />
      <span>
        {amount}
        <span className="sr-only"> diamantes</span>
      </span>
    </span>
  );
}

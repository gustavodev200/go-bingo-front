import { cn } from '@/lib/utils';
import { ballColor } from './render';

/** A small billiard ball (HUD), dimmed once pocketed. */
export function MiniBall({ n, gone = false, className }: { n: number; gone?: boolean; className?: string }) {
  const color = ballColor(n);
  const stripe = n > 8;
  return (
    <span
      aria-hidden
      className={cn('relative inline-block size-3.5 shrink-0 overflow-hidden rounded-full shadow-[inset_-1px_-2px_2px_rgb(0_0_0/0.35)]', gone && 'opacity-25 grayscale', className)}
      style={{ background: stripe ? `linear-gradient(180deg,#f8f6ee 0 24%,${color} 24% 76%,#f8f6ee 76%)` : n === 0 ? '#fbfaf3' : color }}
    >
      {n > 0 && <span className="absolute inset-[28%] rounded-full bg-white/90" />}
    </span>
  );
}

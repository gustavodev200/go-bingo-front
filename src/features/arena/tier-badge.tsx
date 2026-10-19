import { TIERS, tierIndexFor } from '@/contracts';
import { cn } from '@/lib/utils';

const STYLE: Record<(typeof TIERS)[number]['id'], { icon: string; className: string }> = {
  BRONZE: { icon: '🥉', className: 'bg-orange-400/15 text-orange-200 ring-orange-300/40' },
  PRATA: { icon: '🥈', className: 'bg-slate-300/15 text-slate-100 ring-slate-200/40' },
  OURO: { icon: '🥇', className: 'bg-amber-300/15 text-amber-200 ring-amber-300/50' },
  PLATINA: { icon: '💠', className: 'bg-cyan-300/15 text-cyan-100 ring-cyan-200/50' },
  DIAMANTE: { icon: '💎', className: 'bg-sky-400/15 text-sky-100 ring-sky-300/50' },
  LENDA: { icon: '👑', className: 'bg-fuchsia-400/20 text-fuchsia-100 ring-fuchsia-300/60' },
};

export function tierFor(points: number) {
  const index = tierIndexFor(points);
  return { index, tier: TIERS[index], next: TIERS[index + 1] ?? null };
}

/** Liga do jogador pelos pontos (Bronze → Lenda). */
export function TierBadge({ points, className }: { points: number; className?: string }) {
  const { tier } = tierFor(points);
  const style = STYLE[tier.id];
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ring-1', style.className, className)}>
      <span aria-hidden>{style.icon}</span>
      {tier.label}
    </span>
  );
}

export function tierIcon(id: (typeof TIERS)[number]['id']): string {
  return STYLE[id].icon;
}

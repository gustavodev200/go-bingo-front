'use client';

import { useState, type CSSProperties } from 'react';
import { TRUCO_TARGET_SCORE, type Team } from '@/contracts';
import { cn } from '@/lib/utils';
import styles from './truco.module.css';

/** Seeds in the middle at the start: enough for both teams to pull. */
const MONTE = TRUCO_TARGET_SCORE * 2 - 1;

const SEED_COLORS = {
  monte: { body: '#b91c1c', cap: '#111' },
  us: { body: '#10b981', cap: '#052e22' },
  them: { body: '#fb7185', cap: '#3b0a14' },
} as const;

/** Where each pile sits on the felt, and where a pulled seed starts from (the middle of the felt). */
const PILE = {
  us: { className: 'bottom-[9%] left-[7%]', from: { x: '36cqw', y: '-36cqh' }, glow: 'rgb(16 185 129 / 0.7)', label: 'Nós', text: 'text-emerald-200' },
  them: { className: 'top-[11%] right-[7%]', from: { x: '-36cqw', y: '32cqh' }, glow: 'rgb(251 113 133 / 0.7)', label: 'Eles', text: 'text-rose-200' },
} as const;

/** Golden-angle spiral: a natural-looking heap that stays compact as it grows. */
function spot(i: number): CSSProperties {
  const angle = i * 2.39996;
  const r = 0.62 * Math.sqrt(i);
  return {
    left: `calc(50% + ${(Math.cos(angle) * r).toFixed(2)}em - 0.5em)`,
    top: `calc(50% + ${(Math.sin(angle) * r * 0.8).toFixed(2)}em - 0.43em)`,
    '--seed-rot': `${(i * 47) % 360}deg`,
  } as CSSProperties;
}

interface Seen {
  key: string;
  scores: [number, number];
  /** Scores before the last change: new seeds are staggered from here. */
  from: [number, number];
  /** Seeds below this were already there (joined mid-match): no animation. */
  base: [number, number];
}

/** Remembers the previous scores (React's "state from the previous render" pattern). */
function useScoreHistory(scores: [number, number]): Seen {
  const key = `${scores[0]}-${scores[1]}`;
  const [seen, setSeen] = useState<Seen>({ key, scores, from: scores, base: scores });
  if (seen.key !== key) {
    const reset = scores[0] < seen.scores[0] || scores[1] < seen.scores[1];
    const next: Seen = { key, scores, from: reset ? [0, 0] : seen.scores, base: reset ? [0, 0] : seen.base };
    setSeen(next);
    return next;
  }
  return seen;
}

function Pile({ side, count, base, from }: { side: 'us' | 'them'; count: number; base: number; from: number }) {
  const pile = PILE[side];
  const colors = SEED_COLORS[side];
  return (
    <div className={cn('pointer-events-none absolute flex flex-col items-center gap-1', pile.className)} data-testid={`tentos-${side}`} data-count={count}>
      <div className="relative size-[5.2em] text-[clamp(10px,min(3.2vw,3.2dvh),18px)]">
        {Array.from({ length: count }, (_, i) => {
          const pulled = i >= base;
          return (
            <span
              key={i}
              data-pulled={pulled || undefined}
              className={cn(styles.seed, pulled && styles.pull)}
              style={{
                ...spot(i),
                '--seed-body': colors.body,
                '--seed-cap': colors.cap,
                '--from-x': pile.from.x,
                '--from-y': pile.from.y,
                animationDelay: pulled ? `${Math.max(0, i - from) * 140}ms` : undefined,
              } as CSSProperties}
            />
          );
        })}
      </div>
      <span key={count} className={cn('rounded-full bg-black/45 px-2 py-0.5 text-[11px] font-black tabular-nums', pile.text, count > 0 && styles.pileGlow)} style={{ '--pile-glow': pile.glow } as CSSProperties}>
        {pile.label} {count}
      </span>
    </div>
  );
}

/**
 * Score as seeds on the felt, as at a real table: a heap in the middle and each team
 * pulling its tentos to its own side (ours bottom-left, theirs top-right), in its own color.
 * Decorative: the scoreboard on top keeps the numbers.
 */
export function TentoPiles({ scores, myTeam }: { scores: [number, number]; myTeam: Team }) {
  const seen = useScoreHistory(scores);
  const them = (1 - myTeam) as Team;
  const monte = Math.max(0, MONTE - scores[0] - scores[1]);
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <div className="absolute top-1/2 left-1/2 size-[6em] -translate-1/2 text-[clamp(10px,min(3.2vw,3.2dvh),18px)]" data-testid="tentos-monte" data-count={monte}>
        {Array.from({ length: monte }, (_, i) => (
          <span key={i} className={styles.seed} style={{ ...spot(i), '--seed-body': SEED_COLORS.monte.body, '--seed-cap': SEED_COLORS.monte.cap } as CSSProperties} />
        ))}
      </div>
      <Pile side="us" count={scores[myTeam]} base={seen.base[myTeam]} from={seen.from[myTeam]} />
      <Pile side="them" count={scores[them]} base={seen.base[them]} from={seen.from[them]} />
    </div>
  );
}

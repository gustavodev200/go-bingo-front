'use client';

import { Home, RotateCcw } from 'lucide-react';
import type { Team, TrucoMatchResult } from '@/contracts';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useBusy } from './action-bar';
import styles from './truco.module.css';

const CONFETTI = ['#fde047', '#34d399', '#f472b6', '#60a5fa', '#fb923c'];

export function ResultPanel({ result, myTeam, onRematch, onLeave }: { result: TrucoMatchResult; myTeam: Team; onRematch(): Promise<unknown>; onLeave(): Promise<unknown> }) {
  const { busy, run } = useBusy();
  const won = result.winnerTeam === myTeam;
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center overflow-hidden bg-black/55 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="truco-result-title">
      {won &&
        Array.from({ length: 28 }, (_, i) => (
          <span
            key={i}
            aria-hidden
            className={cn('absolute top-0 h-3 w-2 rounded-sm', styles.confetti)}
            style={{ left: `${(i * 37) % 100}%`, background: CONFETTI[i % CONFETTI.length], animationDuration: `${2.4 + (i % 5) * 0.5}s`, animationDelay: `${(i % 7) * 0.3}s` }}
          />
        ))}
      <div className="glass relative flex w-full max-w-sm flex-col items-center gap-3 p-6 text-center">
        <span aria-hidden className="text-6xl">
          {won ? '🏆' : '🃏'}
        </span>
        <h2 id="truco-result-title" className={cn('font-display text-4xl font-black', won ? 'text-marquee' : 'text-rose-200')}>
          {won ? 'Vitória!' : 'Derrota'}
        </h2>
        <p className="text-sm text-violet-100">
          {result.reason === 'abandoned' ? (won ? 'Os adversários abandonaram a mesa.' : 'Sua dupla abandonou a mesa.') : won ? 'Vocês fizeram 12 tentos. Essa foi nossa!' : 'Eles chegaram aos 12 tentos.'}
        </p>
        <p className="font-display text-3xl font-black tabular-nums">
          <span className="text-emerald-300">{result.scores[myTeam]}</span>
          <span className="mx-2 text-violet-300">×</span>
          <span className="text-rose-300">{result.scores[1 - myTeam]}</span>
        </p>
        <div className="flex w-full flex-col gap-2 pt-2">
          <Button size="lg" className="h-12 gap-2 rounded-xl text-base" disabled={busy} onClick={run(onRematch)}>
            <RotateCcw aria-hidden /> Jogar de novo
          </Button>
          <Button size="lg" variant="ghost" className="h-12 gap-2 rounded-xl text-violet-200" disabled={busy} onClick={run(onLeave)}>
            <Home aria-hidden /> Sair da mesa
          </Button>
        </div>
      </div>
    </div>
  );
}

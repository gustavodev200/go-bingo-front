'use client';

import { Handshake, LogOut, RotateCcw, Trophy } from 'lucide-react';
import type { DamasRoomState } from '@/contracts';
import { Button } from '@/components/ui/button';
import { MatchRewardPanel } from '@/features/arena/reward-panel';
import { useBusy } from '@/features/truco/action-bar';
import { cn } from '@/lib/utils';
import { endReasonText, winnerTitle } from './rules-view';

/** End of the match: who won, why, the rewards and a rematch (colours swap). */
export function ResultPanel({ state, mySeat, onRematch, onLeave }: { state: DamasRoomState; mySeat: number; onRematch(): Promise<unknown>; onLeave(): Promise<unknown> }) {
  const { busy, run } = useBusy();
  const result = state.result!;
  const draw = result.winner === null;
  const iWon = result.winner === mySeat;
  const Icon = draw ? Handshake : Trophy;
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="damas-result-title">
      <div className="glass flex w-full max-w-sm flex-col items-center gap-4 p-6 text-center">
        <Icon aria-hidden className={cn('size-12', iWon ? 'text-amber-300' : 'text-white/70')} />
        <h2 id="damas-result-title" className="font-display text-marquee text-3xl font-bold">
          {winnerTitle(state, result, mySeat)}
        </h2>
        <p className="text-sm text-violet-100">{endReasonText(result.reason, iWon)}</p>
        {draw ? <p className="text-xs text-violet-200/80">Empate não vale moedas nem pontos.</p> : <MatchRewardPanel />}
        <div className="flex w-full flex-col gap-2">
          <Button size="lg" className="h-12 gap-2 rounded-xl text-base" disabled={busy} onClick={run(onRematch)}>
            <RotateCcw aria-hidden /> Revanche (trocar cores)
          </Button>
          <Button variant="ghost" className="h-11 gap-2 rounded-xl" disabled={busy} onClick={run(onLeave)}>
            <LogOut aria-hidden /> Sair da mesa
          </Button>
        </div>
      </div>
    </div>
  );
}

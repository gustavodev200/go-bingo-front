'use client';

import { LogOut, RotateCcw, Trophy } from 'lucide-react';
import type { BjRoomState } from '@/contracts';
import { Button } from '@/components/ui/button';
import { MatchRewardPanel } from '@/features/arena/reward-panel';
import { useBusy } from '@/features/truco/action-bar';
import { cn } from '@/lib/utils';
import { endReasonText, fmtChips, placementLabel } from './rules-view';

/** End of the tournament: the chip ranking, the rewards and a new match. */
export function ResultPanel({ state, mySeat, onRematch, onLeave }: { state: BjRoomState; mySeat: number; onRematch(): Promise<unknown>; onLeave(): Promise<unknown> }) {
  const { busy, run } = useBusy();
  const result = state.result!;
  const solo = result.standings.length === 1;
  const mine = result.standings.find((s) => s.seat === mySeat);
  const won = !solo && mine?.placement === 1 && !mine.left;
  const winners = result.standings.filter((s) => s.placement === 1 && !s.left);
  const title = solo ? 'Fim do treino' : won ? (winners.length > 1 ? 'Empate no topo!' : 'Você venceu!') : `${winners[0]?.nickname ?? 'Alguém'} venceu!`;
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="bj-result-title">
      <div className="glass flex w-full max-w-sm flex-col items-center gap-4 p-6 text-center">
        <Trophy aria-hidden className={cn('size-12', won ? 'text-amber-300' : 'text-white/70')} />
        <h2 id="bj-result-title" className="font-display text-marquee text-3xl font-bold">
          {title}
        </h2>
        <p className="text-sm text-violet-100">{solo ? `Você terminou com ${fmtChips(mine?.chips ?? 0)} fichas.` : endReasonText(result.reason)}</p>
        {!solo && (
          <ol className="flex w-full flex-col gap-1" aria-label="Classificação">
            {result.standings.map((s) => (
              <li key={s.seat} className={cn('flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm', s.seat === mySeat ? 'bg-amber-300/20 ring-1 ring-amber-300/60' : 'bg-white/5')}>
                <span className="w-7 text-left font-black text-amber-200">{placementLabel(s.placement)}</span>
                <span className="min-w-0 flex-1 truncate text-left font-semibold">
                  {s.nickname}
                  {s.seat === mySeat && <span className="text-amber-200"> (você)</span>}
                </span>
                <span className="font-black tabular-nums">{s.left ? 'saiu' : fmtChips(s.chips)}</span>
              </li>
            ))}
          </ol>
        )}
        {solo ? (
          <p className="text-xs text-violet-200/80">Treino não vale moedas nem pontos. Chame alguém para valer na Arena.</p>
        ) : winners.length === result.standings.length ? (
          <p className="text-xs text-violet-200/80">Todo mundo empatou: ninguém paga nem pontua.</p>
        ) : (
          <MatchRewardPanel />
        )}
        <div className="flex w-full flex-col gap-2">
          <Button size="lg" className="h-12 gap-2 rounded-xl text-base" disabled={busy} onClick={run(onRematch)}>
            <RotateCcw aria-hidden /> Jogar de novo
          </Button>
          <Button variant="ghost" className="h-11 gap-2 rounded-xl" disabled={busy} onClick={run(onLeave)}>
            <LogOut aria-hidden /> Sair da mesa
          </Button>
        </div>
      </div>
    </div>
  );
}

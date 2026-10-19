'use client';

import { LogOut, RotateCcw, Trophy } from 'lucide-react';
import { dominoTeamOf, type DominoRoomState } from '@/contracts';
import { Avatar } from '@/components/stage/avatar';
import { Button } from '@/components/ui/button';
import { MatchRewardPanel } from '@/features/arena/reward-panel';
import { useBusy } from '@/features/truco/action-bar';
import { cn } from '@/lib/utils';
import { TEAM_NAME } from './rules-view';

/** Who won, in words: "Você venceu!", "Bia venceu!", "Sua dupla venceu!", "Empate!". */
export function winnerTitle(state: DominoRoomState, winners: number[], mySeat: number): string {
  if (winners.length === 0) return 'Empate!';
  if (state.rules.teams) return winners.includes(mySeat) ? 'Sua dupla venceu!' : `${TEAM_NAME[dominoTeamOf(winners[0])]} venceu!`;
  return winners.includes(mySeat) ? 'Você venceu!' : `${state.seats[winners[0]]?.nickname ?? 'Alguém'} venceu!`;
}

/** End of the match: the winner, everybody's points and a rematch. */
export function ResultPanel({ state, mySeat, onRematch, onLeave }: { state: DominoRoomState; mySeat: number; onRematch(): Promise<unknown>; onLeave(): Promise<unknown> }) {
  const { busy, run } = useBusy();
  const result = state.result!;
  const iWon = result.winners.includes(mySeat);
  const ranking = state.seats.flatMap((s, seat) => (s ? [{ s, seat, points: result.scores[seat] ?? 0 }] : [])).sort((a, b) => b.points - a.points);
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="domino-result-title">
      <div className="glass flex w-full max-w-sm flex-col items-center gap-4 p-6 text-center">
        <Trophy aria-hidden className={cn('size-12', iWon ? 'text-amber-300' : 'text-white/70')} />
        <h2 id="domino-result-title" className="font-display text-marquee text-3xl font-bold">
          {winnerTitle(state, result.winners, mySeat)}
        </h2>
        {result.reason === 'abandoned' && <p className="text-sm text-violet-100">{state.rules.teams ? 'Um jogador saiu e a dupla dele perdeu.' : 'Os outros jogadores saíram da mesa.'}</p>}
        {state.rules.target > 0 && (
          <ol className="flex w-full flex-col gap-1.5" aria-label="Pontos">
            {ranking.map(({ s, seat, points }) => (
              <li key={seat} className={cn('flex items-center gap-2 rounded-xl px-3 py-1.5', result.winners.includes(seat) ? 'bg-amber-300/20 ring-1 ring-amber-300/60' : 'bg-white/5')}>
                <Avatar id={s.userId} character={s.character} className="w-7" />
                <span className="flex-1 truncate text-left text-sm font-semibold">{s.nickname}</span>
                <span className="text-sm font-black tabular-nums">{points}</span>
              </li>
            ))}
          </ol>
        )}
        <MatchRewardPanel />
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

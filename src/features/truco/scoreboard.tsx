import { TRUCO_TARGET_SCORE, type Team, type TrucoMatchView } from '@/contracts';
import { cn } from '@/lib/utils';
import { BET_LABEL } from './rules-view';

const KIND_LABEL = { ten: 'Mão de dez', iron: 'Mão de ferro' } as const;

/** NÓS × ELES with the round dots of the current hand and what the hand is worth. */
export function Scoreboard({ scores, myTeam, match }: { scores: [number, number]; myTeam: Team; match: TrucoMatchView | null }) {
  const them = (1 - myTeam) as Team;
  const rounds = match?.rounds ?? [];
  return (
    <div role="group" aria-label="Placar" className="flex min-w-0 flex-1 items-stretch overflow-hidden rounded-2xl border border-white/10 bg-violet-950/70 text-center shadow-lg backdrop-blur">
      <div className="flex w-[4.5rem] flex-col justify-center bg-emerald-500/25 px-2 py-1 sm:w-24">
        <span className="text-[10px] font-bold tracking-widest text-emerald-200 uppercase">Nós</span>
        <span aria-label={`Nós: ${scores[myTeam]} tentos`} className="font-display text-2xl leading-none font-black text-white tabular-nums sm:text-3xl">
          {scores[myTeam]}
        </span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col items-center justify-center gap-1 px-2 py-1">
        <span className="text-[10px] font-semibold tracking-widest text-violet-200 uppercase">
          Tentos · até {TRUCO_TARGET_SCORE}
        </span>
        <div className="flex items-center gap-1.5" aria-label="Rodadas da mão">
          {[0, 1, 2].map((i) => {
            const r = rounds[i]?.result ?? null;
            return (
              <span
                key={i}
                title={r === null ? `Rodada ${i + 1}` : r === 'tie' ? 'Empate' : r === myTeam ? 'Nossa' : 'Deles'}
                className={cn('size-3 rounded-full ring-1 ring-white/30', r === null ? 'bg-white/15' : r === 'tie' ? 'bg-slate-300' : r === myTeam ? 'bg-emerald-400' : 'bg-rose-400', match && rounds.length - 1 === i && r === null && 'ring-2 ring-amber-300')}
              />
            );
          })}
        </div>
        {match && (
          <span className="truncate text-[11px] font-bold text-amber-200">
            {match.kind !== 'normal' ? `${KIND_LABEL[match.kind]} · ` : ''}
            Vale {match.value}
            {match.value > 2 && match.kind === 'normal' ? ` (${BET_LABEL[match.value]})` : ''}
          </span>
        )}
      </div>
      <div className="flex w-[4.5rem] flex-col justify-center bg-rose-500/25 px-2 py-1 sm:w-24">
        <span className="text-[10px] font-bold tracking-widest text-rose-200 uppercase">Eles</span>
        <span aria-label={`Eles: ${scores[them]} tentos`} className="font-display text-2xl leading-none font-black text-white tabular-nums sm:text-3xl">
          {scores[them]}
        </span>
      </div>
    </div>
  );
}

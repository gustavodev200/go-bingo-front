import type { Seat, TrucoRoomState } from '@/contracts';
import { cn } from '@/lib/utils';
import { PlayingCard } from './playing-card';
import { positionOf, visibleRound, type TablePosition } from './rules-view';
import styles from './truco.module.css';

const SLOT: Record<TablePosition, string> = {
  bottom: 'left-1/2 top-[58%] -translate-x-1/2',
  top: 'left-1/2 top-[8%] -translate-x-1/2',
  left: 'left-[18%] top-1/2 -translate-y-1/2 -rotate-6',
  right: 'right-[18%] top-1/2 -translate-y-1/2 rotate-6',
};
const ENTER: Record<TablePosition, string> = { bottom: styles.fromBottom, top: styles.fromTop, left: styles.fromLeft, right: styles.fromRight };

/** Cards played in the round on screen, each in front of who played it. */
export function TableCenter({ state, mySeat }: { state: TrucoRoomState; mySeat: Seat }) {
  const shown = visibleRound(state);
  const match = state.match;
  return (
    <div className="absolute inset-[18%_14%] sm:inset-[16%_20%]" aria-label="Mesa">
      {shown && (
        <p className="sr-only" aria-live="polite">
          Rodada {shown.number}: {shown.round.plays.length} cartas na mesa
        </p>
      )}
      {shown?.round.plays.map((p) => {
        const pos = positionOf(p.seat, mySeat);
        const winner = shown.round.result !== null && shown.round.result !== 'tie' && shown.round.winningSeat === p.seat;
        return (
          <div key={`${shown.number}-${p.seat}`} className={cn('absolute', SLOT[pos])}>
            <div className={ENTER[pos]}>
              <PlayingCard card={p.card} size="md" highlight={winner} dim={shown.round.result !== null && !winner && shown.round.result !== 'tie'} />
            </div>
          </div>
        );
      })}
      {match?.kind === 'iron' && (
        <span className={cn('absolute bottom-0 left-1/2 -translate-x-1/2 rounded-full bg-slate-200/90 px-3 py-1 text-[11px] font-black tracking-wide whitespace-nowrap text-slate-900 uppercase', styles.iron)}>Mão de ferro · cartas às cegas</span>
      )}
      {shown?.round.result === 'tie' && <span className="absolute top-1/2 left-1/2 -translate-1/2 rounded-full bg-black/60 px-3 py-1 text-sm font-black text-white">Empatou!</span>}
    </div>
  );
}

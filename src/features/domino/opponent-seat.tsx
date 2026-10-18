'use client';

import { Crown, WifiOff } from 'lucide-react';
import type { DominoSeatPlayer } from '@/contracts';
import { Avatar } from '@/components/stage/avatar';
import { useSecondsLeft } from '@/features/truco/seat-badge';
import { EmoteBubble, TurnClock } from '@/features/uno/opponent-seat';
import { cn } from '@/lib/utils';
import { DominoTileView } from './domino-tile';
import type { DominoEffect } from './store';
import styles from './domino.module.css';

export type Emote = Extract<DominoEffect, { kind: 'emote' }> | null;

/** Small badge naming the team in 2 against 2. */
export function TeamBadge({ team, mine }: { team: number; mine: boolean }) {
  return <span className={cn('rounded-full px-1.5 text-[10px] font-black uppercase', mine ? 'bg-sky-300 text-sky-950' : 'bg-rose-300 text-rose-950')}>{team === 0 ? 'A' : 'B'}</span>;
}

/** An opponent around the table: avatar, name, tiles left (backs), turn, team and connection state. */
export function OpponentSeat({
  player,
  tiles,
  score,
  showScore,
  isTurn,
  isHost,
  team,
  partner,
  deadline,
  emote,
}: {
  player: DominoSeatPlayer;
  tiles: number;
  score: number;
  showScore: boolean;
  isTurn: boolean;
  isHost: boolean;
  /** Team (0/1) in 2 against 2, null when everyone plays alone. */
  team: number | null;
  partner: boolean;
  deadline: number | null;
  emote: Emote;
}) {
  const reconnect = useSecondsLeft(player.reconnectDeadline);
  const backs = Math.min(tiles, 7);
  return (
    <div className="flex flex-col items-center gap-1" data-seat={player.seat}>
      <div className="relative">
        <EmoteBubble seat={player.seat} name={player.nickname} emote={emote} />
        <div className={cn('rounded-full p-0.5 ring-3', isTurn ? 'ring-amber-300' : 'ring-white/40', isTurn && styles.turn, !player.connected && 'opacity-50 grayscale')}>
          <div key={emote?.id} className={cn('flex size-[clamp(34px,min(10vw,7.5dvh),56px)] items-end justify-center overflow-hidden rounded-full bg-black/40', emote && styles.wiggle)}>
            <Avatar id={player.userId} character={player.character} className="w-[85%] translate-y-[6%]" />
          </div>
        </div>
        {isHost && <Crown aria-label="Anfitrião" className="absolute -top-2 -left-1 size-4 fill-amber-300 text-amber-500" />}
      </div>
      <span className="flex max-w-[6.5rem] items-center gap-1 truncate rounded-full bg-black/45 px-2 py-0.5 text-xs font-semibold text-white backdrop-blur">
        {team !== null && <TeamBadge team={team} mine={partner} />}
        <span className="truncate">{player.nickname}</span>
        {showScore && <span className="text-amber-200 tabular-nums">· {score}</span>}
      </span>
      {isTurn && <TurnClock deadline={deadline} />}
      {!player.connected && (
        <span role="status" className="flex items-center gap-1 rounded-full bg-amber-500/90 px-2 py-0.5 text-[10px] font-bold text-black">
          <WifiOff aria-hidden className="size-3" />
          {reconnect !== null ? `${reconnect}s` : '…'}
        </span>
      )}
      <div aria-label={`${tiles} ${tiles === 1 ? 'peça' : 'peças'} na mão`} className="flex items-center gap-1">
        <span className="flex -space-x-1">
          {Array.from({ length: backs }, (_, i) => (
            <DominoTileView key={i} tile={null} className={cn(styles.deal, 'w-2 sm:w-2.5')} style={{ animationDelay: `${i * 40}ms` }} />
          ))}
        </span>
        <span className="rounded-full bg-white px-1.5 text-xs font-black text-slate-900 tabular-nums shadow">{tiles}</span>
      </div>
    </div>
  );
}

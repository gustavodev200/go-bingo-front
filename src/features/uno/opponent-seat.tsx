'use client';

import { Crown, WifiOff } from 'lucide-react';
import type { UnoSeatPlayer } from '@/contracts';
import { Avatar } from '@/components/stage/avatar';
import { useSecondsLeft } from '@/features/truco/seat-badge';
import { cn } from '@/lib/utils';
import { EMOTE_ICON, EMOTE_LABEL } from './rules-view';
import type { UnoEffect } from './store';
import { UnoCardView } from './uno-card';
import styles from './uno.module.css';

/** Seconds left on the turn clock, shown when it gets tight. */
export function TurnClock({ deadline }: { deadline: number | null }) {
  const seconds = useSecondsLeft(deadline);
  if (seconds === null || seconds > 10) return null;
  return (
    <span role="timer" aria-label={`${seconds} segundos`} className={cn('rounded-full px-2 py-0.5 text-xs font-black tabular-nums shadow', seconds <= 5 ? 'bg-rose-500 text-white' : 'bg-amber-300 text-amber-950')}>
      {seconds}s
    </span>
  );
}

/** Emote bubble over a player's avatar. */
export function EmoteBubble({ seat, name, emote }: { seat: number; name: string; emote: Extract<UnoEffect, { kind: 'emote' }> | null }) {
  if (!emote || emote.seat !== seat) return null;
  return (
    <span key={emote.id} aria-label={`${name}: ${EMOTE_LABEL[emote.emote]}`} className={cn('absolute -top-10 left-1/2 z-20 rounded-2xl bg-white px-2 py-1 text-2xl leading-none shadow-lg', styles.bubble)}>
      {EMOTE_ICON[emote.emote]}
    </span>
  );
}

/** An opponent around the table: avatar, name, cards (backs), turn, UNO and connection state. */
export function OpponentSeat({
  player,
  cards,
  score,
  showScore,
  isTurn,
  isHost,
  saidUno,
  exposed,
  deadline,
  emote,
}: {
  player: UnoSeatPlayer;
  cards: number;
  score: number;
  showScore: boolean;
  isTurn: boolean;
  isHost: boolean;
  saidUno: boolean;
  exposed: boolean;
  deadline: number | null;
  emote: Extract<UnoEffect, { kind: 'emote' }> | null;
}) {
  const reconnect = useSecondsLeft(player.reconnectDeadline);
  const fan = Math.min(cards, 7);
  return (
    <div className="flex flex-col items-center gap-1" data-seat={player.seat}>
      <div className="relative">
        <EmoteBubble seat={player.seat} name={player.nickname} emote={emote} />
        <div className={cn('rounded-full p-0.5 ring-3', isTurn ? 'ring-amber-300' : 'ring-white/40', isTurn && styles.turn, !player.connected && 'opacity-50 grayscale')}>
          <div key={emote?.id} className={cn('flex size-[clamp(36px,min(11vw,8.5dvh),60px)] items-end justify-center overflow-hidden rounded-full bg-black/40', emote && styles.wiggle)}>
            <Avatar id={player.userId} character={player.character} className="w-[85%] translate-y-[6%]" />
          </div>
        </div>
        {isHost && <Crown aria-label="Anfitrião" className="absolute -top-2 -left-1 size-4 fill-amber-300 text-amber-500" />}
        {(saidUno || exposed) && (
          <span className={cn('font-display absolute -right-3 -bottom-1 rounded-full px-1.5 py-0.5 text-[10px] font-black italic shadow', exposed ? 'bg-rose-600 text-white' : 'bg-amber-300 text-red-700', exposed && styles.pulse)}>
            {exposed ? 'SEM UNO!' : 'UNO!'}
          </span>
        )}
      </div>
      <span className="flex max-w-[7.5rem] items-center gap-1 truncate rounded-full bg-black/45 px-2 py-0.5 text-xs font-semibold text-white backdrop-blur">
        <span className="truncate">{player.nickname}</span>
        {showScore && <span className="text-amber-200 tabular-nums">· {score}</span>}
      </span>
      {isTurn && <TurnClock deadline={deadline} />}
      {!player.connected && (
        <span role="status" className="flex items-center gap-1 rounded-full bg-amber-500/90 px-2 py-0.5 text-[10px] font-bold text-black">
          <WifiOff aria-hidden className="size-3" />
          Reconectando{reconnect !== null ? ` ${reconnect}s` : '…'}
        </span>
      )}
      {cards > 0 && (
        <div aria-label={`${cards} ${cards === 1 ? 'carta' : 'cartas'} na mão`} className="relative flex items-center">
          <span className="flex -space-x-[60%]">
            {Array.from({ length: fan }, (_, i) => (
              <UnoCardView key={i} card={null} size="xs" className={styles.deal} style={{ rotate: `${(i - (fan - 1) / 2) * 9}deg`, animationDelay: `${i * 40}ms` }} />
            ))}
          </span>
          <span className="ml-1 rounded-full bg-white px-1.5 text-xs font-black text-slate-900 tabular-nums shadow">{cards}</span>
        </div>
      )}
    </div>
  );
}

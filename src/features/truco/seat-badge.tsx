'use client';

import { Crown, WifiOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { TrucoSeatPlayer } from '@/contracts';
import { Avatar } from '@/components/stage/avatar';
import { cn } from '@/lib/utils';
import { PlayingCard } from './playing-card';
import type { TablePosition } from './rules-view';
import { GESTURES, type Conventions } from './signals';
import type { TrucoEffect } from './store';
import styles from './truco.module.css';

/** Seconds left until `deadline` (epoch ms), ticking every second; null without a deadline. */
export function useSecondsLeft(deadline: number | null): number | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (deadline === null) return;
    const id = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(id);
  }, [deadline]);
  return deadline === null ? null : Math.max(0, Math.ceil((deadline - now) / 1_000));
}

export const TEAM_TONE = {
  us: { ring: 'ring-emerald-400', text: 'text-emerald-200', bg: 'bg-emerald-500/20', chip: 'bg-emerald-500' },
  them: { ring: 'ring-rose-400', text: 'text-rose-200', bg: 'bg-rose-500/20', chip: 'bg-rose-500' },
} as const;

export function SeatBadge({
  player,
  position,
  ours,
  isTurn,
  isDealer,
  isHost,
  cardsLeft,
  gesture,
  conventions,
}: {
  player: TrucoSeatPlayer;
  position: TablePosition;
  ours: boolean;
  isTurn: boolean;
  isDealer: boolean;
  isHost: boolean;
  cardsLeft: number;
  gesture: Extract<TrucoEffect, { kind: 'gesture' }> | null;
  conventions: Conventions;
}) {
  const tone = TEAM_TONE[ours ? 'us' : 'them'];
  const seconds = useSecondsLeft(player.reconnectDeadline);
  const vertical = position === 'left' || position === 'right';
  const known = gesture?.gesture ? GESTURES[gesture.gesture] : null;

  return (
    <div className={cn('flex items-center gap-1.5', vertical ? 'flex-col' : 'flex-row')} data-position={position}>
      <div className="relative flex flex-col items-center gap-1">
        <div className={cn('relative rounded-full p-0.5 ring-3', tone.ring, isTurn && styles.turn, !player.connected && 'opacity-50 grayscale')}>
          <div key={gesture?.id} className={cn('flex size-[clamp(42px,min(14vw,10dvh),72px)] items-end justify-center overflow-hidden rounded-full bg-violet-950/70', gesture && styles.wiggle)}>
            <Avatar id={player.userId} character={player.character} className="w-[85%] translate-y-[6%]" />
          </div>
          {isHost && <Crown aria-label="Anfitrião" className="absolute -top-2 -left-1 size-4 fill-amber-300 text-amber-500" />}
          {isDealer && <span title="Quem deu as cartas" className="absolute -right-1 -bottom-1 flex size-5 items-center justify-center rounded-full bg-white text-[10px] font-black text-slate-900 shadow">D</span>}
          {gesture && (
            <span
              key={`b${gesture.id}`}
              // The seat at the top hugs the scoreboard: its bubble opens to the side.
              className={cn('absolute z-20 rounded-2xl bg-white px-2 py-1 text-center font-bold whitespace-nowrap text-slate-900 shadow-lg ring-2', position === 'top' ? 'top-1/2 right-full mr-2 -translate-y-1/2' : '-top-11 left-1/2 -translate-x-1/2', known ? 'ring-emerald-400' : 'ring-white', styles.bubble)}
            >
              {known ? (
                <span role="img" aria-label={`${known.label}: ${conventions[gesture.gesture!]}`} className="text-2xl leading-none">
                  {known.emoji}
                </span>
              ) : (
                <span aria-label="fez um gesto">✨</span>
              )}
            </span>
          )}
        </div>
        <span className={cn('max-w-[6.5rem] truncate rounded-full px-2 py-0.5 text-xs font-semibold backdrop-blur', tone.bg, tone.text)}>{player.nickname}</span>
        {!player.connected && (
          <span role="status" className="flex items-center gap-1 rounded-full bg-amber-500/90 px-2 py-0.5 text-[10px] font-bold text-black">
            <WifiOff aria-hidden className="size-3" />
            Reconectando{seconds !== null ? ` ${seconds}s` : '…'}
          </span>
        )}
      </div>
      {cardsLeft > 0 && (
        <div aria-label={`${cardsLeft} cartas na mão`} className="flex -space-x-[45%]">
          {Array.from({ length: cardsLeft }, (_, i) => (
            <PlayingCard key={i} card={null} size="xs" className={cn(styles.deal)} style={{ rotate: `${(i - (cardsLeft - 1) / 2) * 12}deg` }} />
          ))}
        </div>
      )}
    </div>
  );
}

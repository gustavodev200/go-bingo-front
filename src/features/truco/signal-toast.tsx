'use client';

import { partnerOf, type Seat, type TrucoRoomState } from '@/contracts';
import { Avatar } from '@/components/stage/avatar';
import { cn } from '@/lib/utils';
import { GESTURES, type Conventions } from './signals';
import { useTrucoStore } from './store';
import styles from './truco.module.css';

/**
 * My partner's secret signal, big in the middle of the table for a few seconds:
 * their avatar making the gesture and what it means for us. Only the partner
 * ever receives which gesture it was, so this never shows for opponents.
 */
export function PartnerSignalToast({ state, mySeat, conventions }: { state: TrucoRoomState; mySeat: Seat; conventions: Conventions }) {
  const partner = partnerOf(mySeat);
  const effect = useTrucoStore((s) => s.effects.findLast((e) => e.kind === 'gesture' && e.seat === partner && e.gesture !== null));
  if (!effect || effect.kind !== 'gesture' || !effect.gesture) return null;
  const player = state.seats[partner];
  const gesture = GESTURES[effect.gesture];
  return (
    <div role="status" aria-label="Sinal do parceiro" className="pointer-events-none absolute inset-x-0 top-[24%] z-30 flex justify-center px-3">
      <div key={effect.id} className={cn('flex max-w-sm items-center gap-3 rounded-3xl bg-white/95 py-3 pr-5 pl-3 text-slate-900 shadow-2xl ring-4 ring-emerald-400', styles.signalCard)}>
        <div className="relative shrink-0">
          <div className={cn('flex size-16 items-end justify-center overflow-hidden rounded-full bg-violet-950 ring-3 ring-emerald-400 sm:size-20', styles.wiggle)}>
            {player && <Avatar id={player.userId} character={player.character} className="w-[85%] translate-y-[6%]" />}
          </div>
          <span aria-hidden className="absolute -right-2 -bottom-2 text-4xl drop-shadow">
            {gesture.emoji}
          </span>
        </div>
        <div className="flex min-w-0 flex-col">
          <span className="text-xs font-bold tracking-wide text-emerald-700 uppercase">
            {player?.nickname ?? 'Parceiro'} · {gesture.label}
          </span>
          <span className="font-display text-xl leading-tight font-black">{conventions[effect.gesture]}</span>
          <span className="text-[11px] font-semibold text-slate-500">Só você viu este sinal</span>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { useTrucoStore, type ShoutTone, type TrucoEffect } from './store';
import styles from './truco.module.css';

const LIFETIME: Record<TrucoEffect['kind'], number> = { shout: 1_700, banner: 2_400, gesture: 4_500 };

/** Removes each visual effect after its animation, so the store never grows. */
export function useEffectsExpiry() {
  const effects = useTrucoStore((s) => s.effects);
  const scheduled = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  useEffect(() => {
    for (const e of effects) {
      if (scheduled.current.has(e.id)) continue;
      scheduled.current.set(
        e.id,
        setTimeout(() => {
          scheduled.current.delete(e.id);
          useTrucoStore.getState().removeEffect(e.id);
        }, LIFETIME[e.kind]),
      );
    }
  }, [effects]);
  useEffect(() => {
    const timers = scheduled.current;
    return () => {
      timers.forEach(clearTimeout);
      timers.clear();
    };
  }, []);
}

const TONE: Record<ShoutTone, string> = {
  bet: 'from-yellow-200 via-amber-300 to-orange-500 text-red-800',
  good: 'from-emerald-100 via-emerald-300 to-emerald-500 text-emerald-950',
  bad: 'from-rose-100 via-rose-300 to-rose-500 text-rose-950',
  info: 'from-white via-violet-100 to-violet-300 text-violet-950',
};

/** The big "TRUCO!" in the middle of the table (and every other shout). Decorative: the state shows the same thing. */
export function ShoutOverlay() {
  const shout = useTrucoStore((s) => s.effects.findLast((e) => e.kind === 'shout'));
  if (!shout || shout.kind !== 'shout') return null;
  return (
    <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center overflow-hidden" aria-live="assertive">
      {shout.tone === 'bet' && <span aria-hidden className={cn('absolute size-[140%] rounded-full', styles.rays)} />}
      <span
        key={shout.id}
        className={cn(
          'font-display relative rounded-3xl border-4 border-white bg-linear-to-b px-6 py-2 text-[clamp(2.4rem,12vw,5.5rem)] leading-none font-black tracking-tight uppercase shadow-[0_10px_0_rgb(0_0_0/0.35),0_0_60px_rgb(253_224_71/0.6)]',
          TONE[shout.tone],
          styles.shout,
        )}
      >
        {shout.text}
      </span>
    </div>
  );
}

const BANNER_TONE: Record<ShoutTone, string> = {
  bet: 'bg-amber-300 text-amber-950',
  good: 'bg-emerald-400 text-emerald-950',
  bad: 'bg-rose-500 text-white',
  info: 'bg-slate-200 text-slate-900',
};

/** Round result notice ("Vocês ganharam a 1ª rodada"), shown to every player from their own side. */
export function RoundBanner() {
  const banner = useTrucoStore((s) => s.effects.findLast((e) => e.kind === 'banner'));
  if (!banner || banner.kind !== 'banner') return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 top-[38%] z-20 flex justify-center px-4" role="status" aria-live="polite">
      <span key={banner.id} className={cn('rounded-full px-5 py-2 text-center text-base font-black shadow-[0_6px_0_rgb(0_0_0/0.3)] sm:text-lg', BANNER_TONE[banner.tone], styles.bubble)}>
        {banner.text}
      </span>
    </div>
  );
}

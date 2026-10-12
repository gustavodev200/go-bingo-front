'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { useTrucoStore, type ShoutTone, type TrucoEffect } from './store';
import styles from './truco.module.css';

const LIFETIME: Record<TrucoEffect['kind'], number> = { shout: 1_700, gesture: 2_600 };

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

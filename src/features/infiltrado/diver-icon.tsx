'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { drawPortrait } from './media/sprites';

/** Small diver in its color. `animate` bobs it (lobby); otherwise drawn once. */
export function DiverIcon({ color, className, animate = false, ghost, dead }: { color: number; className?: string; animate?: boolean; ghost?: boolean; dead?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv || !cv.getContext('2d')) return;
    const draw = () => drawPortrait(cv, color, performance.now() / 1000, { ghost, dead });
    draw();
    if (!animate) return;
    const id = setInterval(draw, 120);
    return () => clearInterval(id);
  }, [color, animate, ghost, dead]);
  return <canvas ref={ref} width={96} height={96} aria-hidden className={cn('block', className)} />;
}

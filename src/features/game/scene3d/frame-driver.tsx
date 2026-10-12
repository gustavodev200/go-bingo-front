'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createFrameMonitor, createFramePacer } from './frame-pacing';
import type { TierSettings } from './quality';
import { useStageActivity } from './stage-activity';

/**
 * Relógio da cena para Canvas em `frameloop="demand"`: pede quadros no teto do perfil (ativo ou ocioso) e para de vez
 * com a aba oculta ou o canvas fora da tela (ex.: lobby rolado). Com `onDecline`, também adapta a qualidade.
 */
export function FrameDriver({ settings, onDecline, onIncline }: { settings: TierSettings; onDecline?: () => void; onIncline?: () => void }) {
  const invalidate = useThree((s) => s.invalidate);
  const gl = useThree((s) => s.gl);
  const activity = useStageActivity();
  const [monitor] = useState(() => createFrameMonitor());
  const latest = useRef({ settings, onDecline, onIncline });
  useLayoutEffect(() => {
    latest.current = { settings, onDecline, onIncline };
  });

  useEffect(() => {
    const canvas = gl.domElement;
    const pacer = createFramePacer();
    let onScreen = true;
    let raf = 0;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const { activeFps, idleFps } = latest.current.settings;
      if (pacer.due(now, activity.isActive(now) ? activeFps : idleFps)) invalidate();
    };
    const sync = () => {
      const run = onScreen && document.visibilityState !== 'hidden';
      if (run && !raf) {
        pacer.reset();
        raf = requestAnimationFrame(tick);
      } else if (!run && raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    };
    const observer =
      typeof IntersectionObserver === 'undefined'
        ? null
        : new IntersectionObserver((entries) => {
            onScreen = entries.some((e) => e.isIntersecting);
            sync();
          });
    observer?.observe(canvas);
    document.addEventListener('visibilitychange', sync);
    sync();
    return () => {
      observer?.disconnect();
      document.removeEventListener('visibilitychange', sync);
      cancelAnimationFrame(raf);
      raf = 0;
    };
  }, [gl, invalidate, activity]);

  // Mede o quadro realmente desenhado: com GPU/CPU no limite o rAF atrasa e a entrega fica abaixo do teto.
  useFrame(() => {
    const { settings: s, onDecline: decline, onIncline: incline } = latest.current;
    if (!decline) return;
    const now = performance.now();
    const step = monitor.record(now, activity.isActive(now) ? s.activeFps : s.idleFps);
    if (step === 'decline') decline();
    else if (step === 'incline') incline?.();
  });

  return null;
}

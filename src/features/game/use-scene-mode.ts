'use client';

import { useCallback, useState } from 'react';
import { pickDisplayMode, type DisplayMode } from './scene3d/display-mode';
import type { QualityOverride } from './scene3d/quality';
import { readPreferredMode, readQualityOverride, writePreferredMode, writeQualityOverride } from './scene3d/scene-prefs';

function hasWebgl2(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    return document.createElement('canvas').getContext('webgl2') !== null;
  } catch {
    return false;
  }
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Decide 3D ou 2D (sem baixar o three.js), guarda preferências e conta perdas de contexto WebGL. */
export function useSceneMode() {
  const [webgl2] = useState(hasWebgl2);
  const [reducedMotion] = useState(prefersReducedMotion);
  const [preferred, setPreferredState] = useState<DisplayMode | null>(readPreferredMode);
  const [quality, setQualityState] = useState<QualityOverride>(readQualityOverride);
  const [contextLosses, setContextLosses] = useState(0);
  const [failed, setFailed] = useState(false);

  const { mode, reason } = pickDisplayMode({ webgl2, reducedMotion, preferred, contextLosses, failed });

  const setPreferred = useCallback((next: DisplayMode) => {
    writePreferredMode(next);
    setPreferredState(next);
  }, []);
  const setQuality = useCallback((next: QualityOverride) => {
    writeQualityOverride(next);
    setQualityState(next);
  }, []);
  const reportContextLoss = useCallback(() => setContextLosses((n) => n + 1), []);
  const reportFailure = useCallback(() => setFailed(true), []);

  return { mode, reason, setPreferred, quality, setQuality, reportContextLoss, reportFailure, stageKey: contextLosses };
}

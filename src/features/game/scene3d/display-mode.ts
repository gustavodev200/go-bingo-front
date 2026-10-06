export type DisplayMode = '3d' | '2d';
export type DisplayReason = 'ok' | 'no-webgl2' | 'reduced-motion' | 'user' | 'context-lost';

export interface DisplaySignals {
  webgl2: boolean;
  reducedMotion: boolean;
  preferred: DisplayMode | null;
  contextLosses: number;
}

/** RNF-3D-06/08: decide 3D ou 2D antes de baixar o three.js. */
export function pickDisplayMode(s: DisplaySignals): { mode: DisplayMode; reason: DisplayReason } {
  if (!s.webgl2) return { mode: '2d', reason: 'no-webgl2' };
  if (s.contextLosses >= 2) return { mode: '2d', reason: 'context-lost' };
  if (s.preferred === '2d') return { mode: '2d', reason: 'user' };
  if (s.preferred === '3d') return { mode: '3d', reason: 'ok' };
  if (s.reducedMotion) return { mode: '2d', reason: 'reduced-motion' };
  return { mode: '3d', reason: 'ok' };
}

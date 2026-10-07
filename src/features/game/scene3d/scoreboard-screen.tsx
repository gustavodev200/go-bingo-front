'use client';

import { useEffect, useMemo } from 'react';
import { CanvasTexture, SRGBColorSpace } from 'three';
import { SCOREBOARD_CENTER, SCOREBOARD_H, SCOREBOARD_SIZE, SCOREBOARD_W, drawScoreboard, type ScoreboardView } from './scoreboard';

/** Redesenha a canvas e marca a textura para reenviar à GPU. */
function paint(canvas: HTMLCanvasElement, texture: CanvasTexture, view: ScoreboardView) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  drawScoreboard(ctx, view);
  texture.needsUpdate = true;
}

/** Telão como uma única textura de canvas 2D (1 draw call). */
export function ScoreboardScreen({ view }: { view: ScoreboardView }) {
  const canvas = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = SCOREBOARD_W;
    c.height = SCOREBOARD_H;
    return c;
  }, []);
  const texture = useMemo(() => {
    const t = new CanvasTexture(canvas);
    t.colorSpace = SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  }, [canvas]);

  useEffect(() => paint(canvas, texture, view), [canvas, texture, view]);

  useEffect(() => () => texture.dispose(), [texture]);

  return (
    <mesh position={SCOREBOARD_CENTER}>
      <planeGeometry args={SCOREBOARD_SIZE} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  );
}

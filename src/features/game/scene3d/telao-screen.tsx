'use client';

import { useEffect, useMemo } from 'react';
import { CanvasTexture, SRGBColorSpace } from 'three';
import { TELAO_CENTER, TELAO_H, TELAO_SIZE, TELAO_W, drawTelao, type TelaoView } from './telao';

/** Redesenha a canvas e marca a textura para reenviar à GPU. */
function paint(canvas: HTMLCanvasElement, texture: CanvasTexture, view: TelaoView) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  drawTelao(ctx, view);
  texture.needsUpdate = true;
}

/** Telão como uma única textura de canvas 2D: bola atual, 4 anteriores e painel 1–75 (1 draw call). */
export function TelaoScreen({ view }: { view: TelaoView }) {
  const canvas = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = TELAO_W;
    c.height = TELAO_H;
    return c;
  }, []);
  const texture = useMemo(() => {
    const t = new CanvasTexture(canvas);
    t.colorSpace = SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }, [canvas]);

  useEffect(() => paint(canvas, texture, view), [canvas, texture, view]);

  useEffect(() => () => texture.dispose(), [texture]);

  return (
    <mesh position={TELAO_CENTER}>
      <planeGeometry args={TELAO_SIZE} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  );
}

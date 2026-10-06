'use client';

import { useFrame } from '@react-three/fiber';

/** Entrega o delta de cada frame ao agregador de telemetria (amostragem feita lá). */
export function FpsProbe({ onFrame }: { onFrame: (deltaMs: number) => void }) {
  useFrame((_, delta) => onFrame(delta * 1000));
  return null;
}

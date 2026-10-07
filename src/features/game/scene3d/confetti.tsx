'use client';

import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import { Color, DoubleSide, Object3D, type InstancedMesh } from 'three';
import { CONFETTI_COLORS, confettiParticle } from './ambience';

/**
 * Confete da comemoração (início da partida / vitória). Fica montado e escondido desde o começo:
 * o shader compila junto com a cena (no <Preload>) e a comemoração não engasga ao aparecer.
 */
export function Confetti({ count, active }: { count: number; active: boolean }) {
  const mesh = useRef<InstancedMesh>(null);
  const start = useRef(0);
  const o = useMemo(() => new Object3D(), []);
  const colors = useMemo(() => CONFETTI_COLORS.map((c) => new Color(c)), []);

  useLayoutEffect(() => {
    const m = mesh.current;
    if (!m) return;
    for (let i = 0; i < count; i++) m.setColorAt(i, colors[confettiParticle(i, 0).colorIndex]);
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [count, colors]);

  useLayoutEffect(() => {
    if (active) start.current = performance.now();
  }, [active]);

  useFrame(() => {
    const m = mesh.current;
    if (!m || !active) return;
    const elapsed = performance.now() - start.current;
    for (let i = 0; i < count; i++) {
      const p = confettiParticle(i, elapsed);
      o.position.set(...p.position);
      o.rotation.set(...p.rotation);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, count]} visible={active} frustumCulled={false}>
      <planeGeometry args={[0.08, 0.12]} />
      <meshBasicMaterial side={DoubleSide} />
    </instancedMesh>
  );
}

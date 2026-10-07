'use client';

import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import { Color, Object3D, type InstancedMesh } from 'three';
import { bulbLevel } from './ambience';
import { DOOR } from './slots';
import type { ScoreboardView } from './scoreboard';
import { ScoreboardScreen } from './scoreboard-screen';

const BULBS = 28;
const BULB_COLOR = new Color('#fde68a');
const DIM = new Color('#78350f');

/** Salão de game show: chão, plateia em degraus, palco, telão (textura), porta e lâmpadas. O globo é um componente à parte. */
export function Hall({ screen, animatedBulbs, shadows }: { screen: ScoreboardView; animatedBulbs: boolean; shadows: boolean }) {
  const bulbs = useRef<InstancedMesh>(null);
  const color = useMemo(() => new Color(), []);
  const bulbPositions = useMemo(
    () =>
      Array.from({ length: BULBS }, (_, i) => {
        const a = Math.PI * (i / (BULBS - 1));
        return [Math.cos(a) * -5.2, 0.4, -3.4 - Math.sin(a) * 1.6] as const;
      }),
    [],
  );

  useLayoutEffect(() => {
    const mesh = bulbs.current;
    if (!mesh) return;
    const o = new Object3D();
    bulbPositions.forEach((p, i) => {
      o.position.set(...p);
      o.updateMatrix();
      mesh.setMatrixAt(i, o.matrix);
      mesh.setColorAt(i, BULB_COLOR);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [bulbPositions]);

  useFrame(() => {
    const now = performance.now();
    const mesh = bulbs.current;
    if (mesh && animatedBulbs) {
      for (let i = 0; i < BULBS; i++) mesh.setColorAt(i, color.copy(DIM).lerp(BULB_COLOR, bulbLevel(i, now)));
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  });

  return (
    <group>
      <ambientLight intensity={0.6} color="#fde7ff" />
      <directionalLight position={[4, 9, 6]} intensity={1.4} color="#fff1d6" castShadow={shadows} shadow-mapSize={[1024, 1024]} />
      <pointLight position={[0, 4, -3]} intensity={18} color="#f59e0b" distance={14} />

      {/* chão */}
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.01, 0]} receiveShadow={shadows}>
        <planeGeometry args={[30, 20]} />
        <meshStandardMaterial color="#5b21b6" />
      </mesh>
      {/* degraus da plateia (fileiras 2 e 3) */}
      <mesh position={[0, 0.2, 0.0]} receiveShadow={shadows}>
        <boxGeometry args={[10.5, 0.4, 1.4]} />
        <meshStandardMaterial color="#6d28d9" flatShading />
      </mesh>
      <mesh position={[0, 0.4, -1.4]} receiveShadow={shadows}>
        <boxGeometry args={[10.5, 0.8, 1.4]} />
        <meshStandardMaterial color="#7c3aed" flatShading />
      </mesh>
      {/* palco (meio disco atrás da plateia) */}
      <mesh position={[0, 0.15, -3.6]}>
        <cylinderGeometry args={[5.4, 5.4, 0.3, 24, 1, false, Math.PI / 2, Math.PI]} />
        <meshStandardMaterial color="#be185d" flatShading />
      </mesh>
      {/* telão */}
      <mesh position={[0, 3.3, -5.2]}>
        <boxGeometry args={[7.2, 3.8, 0.2]} />
        <meshStandardMaterial color="#111827" />
      </mesh>
      <ScoreboardScreen view={screen} />
      {/* porta */}
      <group position={[DOOR[0], 0, DOOR[2] - 0.8]}>
        <mesh position={[0, 1.2, 0]}>
          <boxGeometry args={[1.6, 2.4, 0.15]} />
          <meshStandardMaterial color="#facc15" />
        </mesh>
        <mesh position={[0, 1.1, 0.05]}>
          <boxGeometry args={[1.2, 2.1, 0.1]} />
          <meshStandardMaterial color="#1e1b4b" />
        </mesh>
      </group>
      {/* lâmpadas de game show */}
      <instancedMesh ref={bulbs} args={[undefined, undefined, BULBS]}>
        <sphereGeometry args={[0.12, 8, 6]} />
        <meshBasicMaterial />
      </instancedMesh>
    </group>
  );
}

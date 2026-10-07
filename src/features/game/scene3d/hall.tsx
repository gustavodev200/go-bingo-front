'use client';

import { Sparkles } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import { Color, Object3D, type InstancedMesh } from 'three';
import { bulbLevel } from './ambience';
import type { Tier } from './quality';
import { DOOR } from './slots';
import type { ScoreboardView } from './scoreboard';
import { ScoreboardScreen } from './scoreboard-screen';
import { BingoSign, Curtain, LightBeams, StageFloor } from './stage-dressing';

const ARC_BULBS = 28;
const FRAME_BULBS = 44;
const BULB_COLOR = new Color('#fde68a');
const DIM = new Color('#78350f');
const FRAME = { w: 7.5, h: 4.1, center: [0, 3.3, -5.08] as const };

/** Lâmpadas: arco na frente do palco + moldura do telão (uma onda só correndo pelas duas). */
function bulbPositions(): [number, number, number][] {
  const arc = Array.from({ length: ARC_BULBS }, (_, i): [number, number, number] => {
    const a = Math.PI * (i / (ARC_BULBS - 1));
    return [Math.cos(a) * -5.2, 0.4, -3.4 - Math.sin(a) * 1.6];
  });
  const perimeter = 2 * (FRAME.w + FRAME.h);
  const frame = Array.from({ length: FRAME_BULBS }, (_, i): [number, number, number] => {
    let d = (i / FRAME_BULBS) * perimeter;
    const [cx, cy, cz] = FRAME.center;
    const left = cx - FRAME.w / 2;
    const top = cy + FRAME.h / 2;
    if (d < FRAME.w) return [left + d, top, cz];
    d -= FRAME.w;
    if (d < FRAME.h) return [left + FRAME.w, top - d, cz];
    d -= FRAME.h;
    if (d < FRAME.w) return [left + FRAME.w - d, top - FRAME.h, cz];
    d -= FRAME.w;
    return [left, top - FRAME.h + d, cz];
  });
  return [...arc, ...frame];
}

const BULB_POSITIONS = bulbPositions();

/** Faixa de LED emissiva na quina dos degraus. */
function Led({ position, color }: { position: [number, number, number]; color: string }) {
  return (
    <mesh position={position}>
      <boxGeometry args={[10.5, 0.06, 0.06]} />
      <meshBasicMaterial color={color} toneMapped={false} />
    </mesh>
  );
}

/** Salão de game show: chão de palco, cortina de veludo, holofotes, plateia em degraus com LED, telão com lâmpadas, porta. O globo é à parte. */
export function Hall({ screen, animatedBulbs, shadows, tier = 'medium' }: { screen: ScoreboardView; animatedBulbs: boolean; shadows: boolean; tier?: Tier }) {
  const bulbs = useRef<InstancedMesh>(null);
  const color = useMemo(() => new Color(), []);
  const positions = BULB_POSITIONS;

  useLayoutEffect(() => {
    const mesh = bulbs.current;
    if (!mesh) return;
    const o = new Object3D();
    positions.forEach((p, i) => {
      o.position.set(...p);
      o.updateMatrix();
      mesh.setMatrixAt(i, o.matrix);
      mesh.setColorAt(i, BULB_COLOR);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [positions]);

  useFrame(() => {
    const now = performance.now();
    const mesh = bulbs.current;
    if (mesh && animatedBulbs) {
      for (let i = 0; i < positions.length; i++) mesh.setColorAt(i, color.copy(DIM).lerp(BULB_COLOR, bulbLevel(i, now)));
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  });

  return (
    <group>
      <hemisphereLight args={['#c4b5fd', '#831843', 0.7]} />
      <ambientLight intensity={0.25} color="#fde7ff" />
      <directionalLight position={[4, 9, 6]} intensity={1.3} color="#fff1d6" castShadow={shadows} shadow-mapSize={[1024, 1024]} />
      <pointLight position={[0, 4, -3]} intensity={18} color="#f59e0b" distance={14} />
      <pointLight position={[-7, 3, 1]} intensity={14} color="#ec4899" distance={12} />
      <pointLight position={[7, 3, 1]} intensity={14} color="#22d3ee" distance={12} />

      {/* chão do salão + palco circular por cima */}
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.01, 0]} receiveShadow={shadows}>
        <planeGeometry args={[60, 40]} />
        <meshStandardMaterial color="#1e0b45" roughness={0.6} />
      </mesh>
      <StageFloor shadows={shadows} />
      <Curtain />

      {/* degraus da plateia (fileiras 2 e 3) com LED na quina */}
      <mesh position={[0, 0.2, 0.0]} receiveShadow={shadows}>
        <boxGeometry args={[10.5, 0.4, 1.4]} />
        <meshStandardMaterial color="#4c1d95" roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.4, -1.4]} receiveShadow={shadows}>
        <boxGeometry args={[10.5, 0.8, 1.4]} />
        <meshStandardMaterial color="#5b21b6" roughness={0.5} />
      </mesh>
      <Led position={[0, 0.39, 0.71]} color="#f472b6" />
      <Led position={[0, 0.79, -0.69]} color="#67e8f9" />

      {/* palco (meio disco atrás da plateia) com borda dourada */}
      <mesh position={[0, 0.15, -3.6]} receiveShadow={shadows}>
        <cylinderGeometry args={[5.4, 5.4, 0.3, 48, 1, false, Math.PI / 2, Math.PI]} />
        <meshStandardMaterial color="#be185d" roughness={0.35} metalness={0.2} />
      </mesh>
      <mesh position={[0, 0.3, -3.6]} rotation-x={-Math.PI / 2}>
        <torusGeometry args={[5.4, 0.05, 6, 64, Math.PI]} />
        <meshBasicMaterial color="#fbbf24" toneMapped={false} />
      </mesh>

      {/* telão com moldura dourada */}
      <mesh position={[0, 3.3, -5.3]}>
        <boxGeometry args={[7.9, 4.5, 0.15]} />
        <meshStandardMaterial color="#92400e" emissive="#f59e0b" emissiveIntensity={0.25} metalness={0.6} roughness={0.35} />
      </mesh>
      <mesh position={[0, 3.3, -5.2]}>
        <boxGeometry args={[7.2, 3.8, 0.2]} />
        <meshStandardMaterial color="#111827" />
      </mesh>
      <ScoreboardScreen view={screen} />
      <BingoSign />

      {/* porta */}
      <group position={[DOOR[0], 0, DOOR[2] - 0.8]}>
        <mesh position={[0, 1.2, 0]}>
          <boxGeometry args={[1.6, 2.4, 0.15]} />
          <meshStandardMaterial color="#facc15" emissive="#f59e0b" emissiveIntensity={0.2} metalness={0.4} roughness={0.4} />
        </mesh>
        <mesh position={[0, 1.1, 0.05]}>
          <boxGeometry args={[1.2, 2.1, 0.1]} />
          <meshStandardMaterial color="#1e1b4b" />
        </mesh>
      </group>

      {/* lâmpadas de game show */}
      <instancedMesh ref={bulbs} args={[undefined, undefined, positions.length]}>
        <sphereGeometry args={[0.11, 8, 6]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>

      {tier !== 'low' && <LightBeams />}
      {tier !== 'low' && <Sparkles count={tier === 'high' ? 90 : 45} scale={[16, 7, 10]} position={[0, 3.5, -1]} size={4} speed={0.35} opacity={0.8} color="#fde68a" />}
    </group>
  );
}

'use client';

import { Billboard, Text } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { Object3D, type Group, type InstancedMesh, type Mesh } from 'three';
import { letterFor } from '@/contracts';
import { GLOBE_CENTER, ballFlight, globeSpin, innerBall } from './globe';

/** Globo-gaiola girando com bolinhas dentro; a cada sorteio acelera e solta a bola com letra e número. */
export function Globe({ lastNumber, drawCount, innerBalls }: { lastNumber: number | null; drawCount: number; innerBalls: number }) {
  const cage = useRef<Mesh>(null);
  const inner = useRef<InstancedMesh>(null);
  const ball = useRef<Group>(null);
  const angle = useRef(0);
  const lastDrawAt = useRef(0);
  const seenCount = useRef<number | null>(null);
  const o = useMemo(() => new Object3D(), []);

  // Só anima um sorteio novo (+1) com a cena montada; recarga, remontagem e ressincronização não animam.
  useEffect(() => {
    if (seenCount.current !== null && drawCount === seenCount.current + 1) lastDrawAt.current = performance.now();
    seenCount.current = drawCount;
  }, [drawCount]);

  useFrame((_, delta) => {
    const now = performance.now();
    const sinceDraw = now - lastDrawAt.current;
    angle.current += globeSpin(now, lastDrawAt.current) * delta;
    cage.current?.rotation.set(angle.current * 0.6, angle.current, 0);

    const mesh = inner.current;
    if (mesh) {
      const shake = lastDrawAt.current > 0 && sinceDraw < 800 ? 3 : 1;
      for (let i = 0; i < innerBalls; i++) {
        const p = innerBall(i, now * shake);
        o.position.set(GLOBE_CENTER[0] + p[0], GLOBE_CENTER[1] + p[1], GLOBE_CENTER[2] + p[2]);
        o.updateMatrix();
        mesh.setMatrixAt(i, o.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    }

    const group = ball.current;
    if (group) {
      const flight = lastDrawAt.current > 0 && lastNumber !== null ? ballFlight(sinceDraw) : null;
      group.visible = flight?.visible ?? false;
      if (flight?.visible) {
        group.position.set(...flight.position);
        group.scale.setScalar(Math.max(flight.scale, 0.0001));
      }
    }
  });

  return (
    <group>
      <mesh ref={cage} position={GLOBE_CENTER}>
        <icosahedronGeometry args={[0.8, 1]} />
        <meshStandardMaterial color="#fbbf24" emissive="#f59e0b" emissiveIntensity={0.6} wireframe />
      </mesh>
      <instancedMesh ref={inner} args={[undefined, undefined, innerBalls]} frustumCulled={false}>
        <sphereGeometry args={[0.11, 8, 6]} />
        <meshStandardMaterial color="#fef3c7" />
      </instancedMesh>
      <mesh position={[GLOBE_CENTER[0], 0.45, GLOBE_CENTER[2]]}>
        <cylinderGeometry args={[0.3, 0.5, 0.6, 8]} />
        <meshStandardMaterial color="#be185d" flatShading />
      </mesh>
      <group ref={ball} visible={false}>
        <mesh>
          <sphereGeometry args={[0.34, 16, 12]} />
          <meshStandardMaterial color="#fde047" roughness={0.3} />
        </mesh>
        {lastNumber !== null && (
          <Billboard>
            <Text position={[0, 0, 0.35]} fontSize={0.17} lineHeight={1} color="#111827" anchorX="center" anchorY="middle" textAlign="center">
              {`${letterFor(lastNumber)}\n${lastNumber}`}
            </Text>
          </Billboard>
        )}
      </group>
    </group>
  );
}

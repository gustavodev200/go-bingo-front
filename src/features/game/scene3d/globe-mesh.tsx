'use client';

import { Billboard, Text } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { Color, Object3D, type Group, type InstancedMesh, type Mesh } from 'three';
import { letterFor } from '@/contracts';
import { LETTER_COLORS } from './ambience';
import { GLOBE_CENTER, ballFlight, globeSpin, innerBall } from './globe';

const INK = '#0f0f14';

/** Bola de sinuca: cor da coluna, verniz e disco branco (sempre de frente) com a letra sobre o número. */
function DrawnBall({ number }: { number: number }) {
  const letter = letterFor(number);
  return (
    <>
      <mesh>
        <sphereGeometry args={[0.44, 32, 24]} />
        <meshPhysicalMaterial color={LETTER_COLORS[letter]} roughness={0.18} clearcoat={1} clearcoatRoughness={0.05} />
      </mesh>
      <Billboard>
        <mesh position={[0, 0, 0.45]}>
          <circleGeometry args={[0.26, 32]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
        <Text position={[0, 0.11, 0.46]} fontSize={0.12} fontWeight={700} color={INK} anchorX="center" anchorY="middle">
          {letter}
        </Text>
        <Text position={[0, -0.04, 0.46]} fontSize={0.22} fontWeight={700} color={INK} anchorX="center" anchorY="middle">
          {String(number)}
        </Text>
      </Billboard>
    </>
  );
}

/** Globo-gaiola girando com bolinhas dentro; a cada sorteio acelera e solta a bola com letra e número. */
export function Globe({ lastNumber, drawCount, innerBalls }: { lastNumber: number | null; drawCount: number; innerBalls: number }) {
  const cage = useRef<Mesh>(null);
  const inner = useRef<InstancedMesh>(null);
  const ball = useRef<Group>(null);
  const angle = useRef(0);
  const lastDrawAt = useRef(0);
  const seenCount = useRef<number | null>(null);
  const o = useMemo(() => new Object3D(), []);

  // Bolinhas da gaiola nas cores das colunas, como as sorteadas.
  useLayoutEffect(() => {
    const mesh = inner.current;
    if (!mesh) return;
    const colors = Object.values(LETTER_COLORS).map((c) => new Color(c));
    for (let i = 0; i < innerBalls; i++) mesh.setColorAt(i, colors[i % colors.length]);
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [innerBalls]);

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
        <meshStandardMaterial color="#fbbf24" emissive="#f59e0b" emissiveIntensity={1.1} wireframe toneMapped={false} />
      </mesh>
      {/* aro de sustentação + brilho dourado de dentro da gaiola */}
      <mesh position={GLOBE_CENTER} rotation-y={0.5}>
        <torusGeometry args={[0.95, 0.045, 8, 48]} />
        <meshStandardMaterial color="#fcd34d" metalness={0.8} roughness={0.25} emissive="#b45309" emissiveIntensity={0.3} />
      </mesh>
      <pointLight position={GLOBE_CENTER} intensity={5} color="#fbbf24" distance={4} />
      <instancedMesh ref={inner} args={[undefined, undefined, innerBalls]} frustumCulled={false}>
        <sphereGeometry args={[0.11, 10, 8]} />
        <meshStandardMaterial roughness={0.2} />
      </instancedMesh>
      <mesh position={[GLOBE_CENTER[0], 0.45, GLOBE_CENTER[2]]}>
        <cylinderGeometry args={[0.3, 0.55, 0.6, 24]} />
        <meshStandardMaterial color="#be185d" metalness={0.3} roughness={0.35} />
      </mesh>
      <group ref={ball} visible={false}>
        {lastNumber !== null && <DrawnBall number={lastNumber} />}
      </group>
    </group>
  );
}

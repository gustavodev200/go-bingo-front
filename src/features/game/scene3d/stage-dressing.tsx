'use client';

import { Text } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { LETTER_COLORS } from './ambience';
import { AdditiveBlending, CanvasTexture, Color, CylinderGeometry, DoubleSide, SRGBColorSpace, ShaderMaterial, type Group } from 'three';

const LETTER_BALLS = Object.entries(LETTER_COLORS).map(([letter, color]) => ({ letter, color }));

/** Chão do palco: espiral de raios e anéis dourados/rosa como em programa de auditório (1 textura de canvas). */
function useStageFloorTexture() {
  const texture = useMemo(() => {
    const size = 1024;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const c = size / 2;
      ctx.fillStyle = '#2a0f5c';
      ctx.fillRect(0, 0, size, size);
      for (let i = 0; i < 32; i++) {
        ctx.beginPath();
        ctx.moveTo(c, c);
        ctx.arc(c, c, c, (i / 32) * Math.PI * 2, ((i + 0.5) / 32) * Math.PI * 2);
        ctx.fillStyle = i % 2 ? 'rgba(236,72,153,0.10)' : 'rgba(167,139,250,0.12)';
        ctx.fill();
      }
      const glow = ctx.createRadialGradient(c, c, 0, c, c, c);
      glow.addColorStop(0, 'rgba(192,132,252,0.55)');
      glow.addColorStop(0.6, 'rgba(91,33,182,0.15)');
      glow.addColorStop(1, 'rgba(18,8,42,0.9)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, size, size);
      [0.22, 0.42, 0.62, 0.82].forEach((r, i) => {
        ctx.beginPath();
        ctx.arc(c, c, r * c, 0, Math.PI * 2);
        ctx.lineWidth = i === 3 ? 14 : 6;
        ctx.strokeStyle = i % 2 ? 'rgba(244,114,182,0.7)' : 'rgba(251,191,36,0.8)';
        ctx.stroke();
      });
    }
    const t = new CanvasTexture(canvas);
    t.colorSpace = SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }, []);
  useEffect(() => () => texture.dispose(), [texture]);
  return texture;
}

export function StageFloor({ shadows }: { shadows: boolean }) {
  const texture = useStageFloorTexture();
  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, 0.005, -0.8]} receiveShadow={shadows}>
      <circleGeometry args={[8.5, 64]} />
      <meshStandardMaterial map={texture} roughness={0.35} metalness={0.15} />
    </mesh>
  );
}

/** Cortina de veludo em arco atrás do palco: dobras vêm de ondular o raio + flat shading. */
export function Curtain() {
  const geometry = useMemo(() => {
    const radius = 10;
    const g = new CylinderGeometry(radius, radius, 10, 160, 1, true, Math.PI / 2 + 0.05, Math.PI - 0.1);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const k = 1 + 0.025 * Math.sin(Math.atan2(x, z) * 70);
      pos.setXYZ(i, x * k, pos.getY(i), z * k);
    }
    g.computeVertexNormals();
    return g;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <group position={[0, 0, -1.2]}>
      <mesh geometry={geometry} position={[0, 5, 0]}>
        <meshStandardMaterial color="#9d174d" roughness={0.85} flatShading side={DoubleSide} />
      </mesh>
      {/* bambinela dourada no alto */}
      <mesh position={[0, 9.4, 0]}>
        <cylinderGeometry args={[9.7, 9.7, 1.2, 64, 1, true, Math.PI / 2 + 0.05, Math.PI - 0.1]} />
        <meshStandardMaterial color="#b45309" emissive="#f59e0b" emissiveIntensity={0.35} metalness={0.5} roughness={0.4} side={DoubleSide} />
      </mesh>
    </group>
  );
}

const beamVertex = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vUv = uv;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;
const beamFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    float edge = pow(abs(dot(vNormal, vView)), 2.0);
    float alpha = uOpacity * pow(vUv.y, 1.4) * edge;
    gl_FragColor = vec4(uColor, alpha);
  }
`;

const BEAMS = [
  { x: -5.5, color: '#fde68a', phase: 0 },
  { x: -2, color: '#f472b6', phase: 1.7 },
  { x: 2, color: '#67e8f9', phase: 3.1 },
  { x: 5.5, color: '#fde68a', phase: 4.4 },
] as const;
const BEAM_HEIGHT = 9;

/** Holofotes "volumétricos": cones aditivos que somem nas bordas e no chão, balançando devagar. */
export function LightBeams() {
  const groups = useRef<(Group | null)[]>([]);
  const materials = useMemo(
    () =>
      BEAMS.map(
        (b) =>
          new ShaderMaterial({
            uniforms: { uColor: { value: new Color(b.color) }, uOpacity: { value: 0.28 } },
            vertexShader: beamVertex,
            fragmentShader: beamFragment,
            transparent: true,
            depthWrite: false,
            blending: AdditiveBlending,
            side: DoubleSide,
          }),
      ),
    [],
  );
  useEffect(() => () => materials.forEach((m) => m.dispose()), [materials]);

  useFrame(() => {
    const t = performance.now() / 1000;
    BEAMS.forEach((b, i) => {
      const g = groups.current[i];
      if (!g) return;
      g.rotation.z = (b.x > 0 ? -0.22 : 0.22) + Math.sin(t * 0.5 + b.phase) * 0.18;
      g.rotation.x = 0.18 + Math.sin(t * 0.37 + b.phase) * 0.08;
    });
  });

  return (
    <>
      {BEAMS.map((b, i) => (
        <group key={i} ref={(g) => void (groups.current[i] = g)} position={[b.x, BEAM_HEIGHT, -1.5]}>
          <mesh position={[0, -BEAM_HEIGHT / 2, 0]} material={materials[i]} renderOrder={10}>
            <cylinderGeometry args={[0.12, 1.7, BEAM_HEIGHT, 28, 1, true]} />
          </mesh>
          <mesh>
            <sphereGeometry args={[0.22, 12, 8]} />
            <meshBasicMaterial color={b.color} toneMapped={false} />
          </mesh>
        </group>
      ))}
    </>
  );
}

/** Bolas B-I-N-G-O flutuando no lado esquerdo do palco, espelhando o globo (as mesmas da tela de entrada). */
export function BingoSign() {
  const balls = useRef<(Group | null)[]>([]);
  useFrame(() => {
    const t = performance.now() / 1000;
    balls.current.forEach((g, i) => {
      if (!g) return;
      g.position.y = Math.sin(t * 2.2 - i * 0.6) * 0.08;
      g.rotation.z = Math.sin(t * 1.6 - i * 0.6) * 0.12;
    });
  });
  return (
    <group position={[-3.45, 0.75, -3.4]}>
      {LETTER_BALLS.map((b, i) => (
        <group key={b.letter} position={[i * 0.62, Math.sin((i / 4) * Math.PI) * 0.25, -Math.sin((i / 4) * Math.PI) * 0.3]}>
          <group ref={(g) => void (balls.current[i] = g)}>
            <mesh>
              <sphereGeometry args={[0.3, 24, 16]} />
              <meshPhysicalMaterial color={b.color} roughness={0.18} clearcoat={1} clearcoatRoughness={0.05} />
            </mesh>
            <mesh position={[0, 0, 0.305]}>
              <circleGeometry args={[0.18, 24]} />
              <meshBasicMaterial color="#ffffff" />
            </mesh>
            <Text position={[0, 0, 0.312]} fontSize={0.2} color="#1e1b4b" anchorX="center" anchorY="middle">
              {b.letter}
            </Text>
          </group>
        </group>
      ))}
    </group>
  );
}

'use client';

import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef, type RefObject } from 'react';
import { Color, DoubleSide, Euler, Matrix4, Object3D, Quaternion, Vector3, type InstancedMesh } from 'three';
import type { Hat, HairStyle } from './avatar-look';
import { pose, type AvatarState } from './pose';

export const MAX_AVATARS = 32; // 25 na sala + quem está saindo
type HatType = Exclude<Hat, 'none'>;
type V3 = [number, number, number];
const HAT_TYPES: HatType[] = ['tophat', 'cap', 'beanie', 'party'];
const GHOST = new Color('#c4b5fd');
const GOLD = new Color('#facc15');
const WHITE = new Color('#ffffff');
const ZERO = new Matrix4().makeScale(0, 0, 0);

/** Proporção "chibi": cabeça grande em cima de um corpo pequeno. */
const HEAD_Y = 1.06;
const HEAD_R = 0.34;
const HAT: Record<HatType, { offset: V3; rot: V3; scale: number }> = {
  tophat: { offset: [0, 0.52, -0.02], rot: [-0.08, 0, 0], scale: 1.2 },
  cap: { offset: [0, 0.31, 0], rot: [-0.18, 0, 0], scale: 1.32 },
  beanie: { offset: [0, 0.09, -0.01], rot: [-0.1, 0, 0], scale: 1.4 },
  party: { offset: [0, 0.56, 0], rot: [-0.12, 0, 0.12], scale: 1.15 },
};
/** Espetos do cabelo "spiky": posição e inclinação (para fora) no espaço da cabeça. */
const SPIKES: { offset: V3; rot: V3 }[] = [
  { offset: [0, 0.38, 0.02], rot: [0.1, 0, 0] },
  { offset: [-0.17, 0.33, 0.04], rot: [0.15, 0, 0.6] },
  { offset: [0.17, 0.33, 0.04], rot: [0.15, 0, -0.6] },
  { offset: [-0.1, 0.32, -0.16], rot: [-0.5, 0, 0.35] },
  { offset: [0.1, 0.32, -0.16], rot: [-0.5, 0, -0.35] },
];
/** Piscar: a cada ~4 s, 120 ms de olho fechado; fase diferente por boneco. */
const BLINK_PERIOD_S = 4.2;
const BLINK_S = 0.12;

type Single =
  | 'torso'
  | 'head'
  | 'nose'
  | 'hairCap'
  | 'hairBun'
  | 'hairLong'
  | 'hairAfro'
  | 'smile'
  | 'wow'
  | 'crown'
  | 'shadow';
type Paired = 'legs' | 'shoes' | 'arms' | 'hands' | 'sclera' | 'pupils' | 'shine' | 'brows' | 'cheeks';
type Parts = Record<Single | Paired | 'spikes', InstancedMesh | null> & { hats: Record<HatType, InstancedMesh | null> };

const SINGLE: Single[] = ['torso', 'head', 'nose', 'hairCap', 'hairBun', 'hairLong', 'hairAfro', 'smile', 'wow', 'crown', 'shadow'];
const PAIRED: Paired[] = ['legs', 'shoes', 'arms', 'hands', 'sclera', 'pupils', 'shine', 'brows', 'cheeks'];
const HAIR_PARTS: Record<HairStyle, (Single | 'spikes')[]> = {
  short: ['hairCap'],
  spiky: ['hairCap', 'spikes'],
  bun: ['hairCap', 'hairBun'],
  long: ['hairCap', 'hairLong'],
  afro: ['hairAfro'],
};

function allMeshes(p: Parts): InstancedMesh[] {
  const { hats, ...rest } = p;
  return [...Object.values(rest), ...Object.values(hats)].filter((m): m is InstancedMesh => m !== null);
}

/** Instâncias por boneco em cada peça (pares = 2, espetos = 5, o resto = 1). */
function perAvatar(p: Parts, mesh: InstancedMesh): number {
  if (mesh === p.spikes) return SPIKES.length;
  return PAIRED.some((k) => p[k] === mesh) ? 2 : 1;
}

/** Bonecos chibi (pele, cabelo, roupa e rosto derivados do id): 1 InstancedMesh por peça para toda a plateia. */
export function AvatarCrowd({
  statesRef,
  onTap,
  castShadow,
  fakeShadow,
}: {
  statesRef: RefObject<Map<string, AvatarState>>;
  onTap: (userId: string) => void;
  castShadow: boolean;
  fakeShadow: boolean;
}) {
  const parts = useRef<Parts>({
    ...(Object.fromEntries([...SINGLE, ...PAIRED, 'spikes'].map((k) => [k, null])) as Record<Single | Paired | 'spikes', null>),
    hats: { tophat: null, cap: null, beanie: null, party: null },
  });
  const ids = useRef<string[]>([]);
  const tmp = useMemo(
    () => ({
      o: new Object3D(),
      base: new Matrix4(),
      head: new Matrix4(),
      limb: new Matrix4(),
      local: new Matrix4(),
      out: new Matrix4(),
      q: new Quaternion(),
      e: new Euler(),
      v: new Vector3(),
      s: new Vector3(),
      color: new Color(),
    }),
    [],
  );

  useLayoutEffect(() => {
    // instanceColor só existe depois do primeiro setColorAt; começa tudo escondido.
    for (const mesh of allMeshes(parts.current)) {
      for (let i = 0; i < mesh.count; i++) {
        mesh.setMatrixAt(i, ZERO);
        mesh.setColorAt(i, WHITE);
      }
      mesh.instanceMatrix.needsUpdate = true;
    }
  }, [fakeShadow]);

  useFrame(() => {
    const p = parts.current;
    const now = performance.now();
    const states = [...(statesRef.current?.values() ?? [])].slice(0, MAX_AVATARS);
    ids.current = states.map((s) => s.userId);

    const compose = (out: Matrix4, parent: Matrix4, offset: V3, rot: V3, scale: V3) => {
      tmp.local.compose(tmp.v.set(...offset), tmp.q.setFromEuler(tmp.e.set(...rot)), tmp.s.set(...scale));
      out.multiplyMatrices(parent, tmp.local);
    };
    /** out = parent × T(offset) × R(rot) × S(scale) */
    const place = (mesh: InstancedMesh | null, index: number, parent: Matrix4, offset: V3, rot: V3 = [0, 0, 0], scale: V3 = [1, 1, 1]) => {
      if (!mesh) return;
      compose(tmp.out, parent, offset, rot, scale);
      mesh.setMatrixAt(index, tmp.out);
    };
    const hide = (mesh: InstancedMesh | null, index: number) => mesh?.setMatrixAt(index, ZERO);

    // Só os bonecos presentes passam por aqui; o `count` (abaixo) faz a GPU desenhar só eles.
    for (let i = 0; i < states.length; i++) {
      const s = states[i];
      const ps = pose(s, now);
      const look = s.look;
      tmp.base.compose(tmp.v.set(...ps.position), tmp.q.setFromEuler(tmp.e.set(0, ps.rotationY, 0)), tmp.s.setScalar(Math.max(ps.scale, 0.0001)));

      // corpo
      place(p.torso, i, tmp.base, [0, 0.5, 0], [0, 0, 0], [1, 1, 0.9]);
      for (const side of [-1, 1] as const) {
        const k = i * 2 + (side < 0 ? 0 : 1);
        // pernas balançam opostas aos braços; sapato acompanha a perna
        compose(tmp.limb, tmp.base, [side * 0.11, 0.3, 0], [side * ps.armSwing * 0.35, 0, 0], [1, 1, 1]);
        place(p.legs, k, tmp.limb, [0, -0.12, 0]);
        place(p.shoes, k, tmp.limb, [0, -0.25, 0.04], [0, 0, 0], [1, 0.6, 1.35]);
        // braço gira no ombro; mão na ponta
        const raise = side > 0 ? ps.armRaise * (2.6 + ps.armSwing) : 0;
        compose(tmp.limb, tmp.base, [side * 0.27, 0.66, 0], [-side * ps.armSwing * 0.5, 0, side * (0.25 + raise)], [1, 1, 1]);
        place(p.arms, k, tmp.limb, [0, -0.13, 0]);
        place(p.hands, k, tmp.limb, [0, -0.28, 0]);
      }

      // cabeça e tudo que vai nela gira junto (headYaw)
      tmp.local.compose(tmp.v.set(0, HEAD_Y, 0), tmp.q.setFromEuler(tmp.e.set(0, ps.headYaw, 0)), tmp.s.set(1, 1, 1));
      tmp.head.multiplyMatrices(tmp.base, tmp.local);
      place(p.head, i, tmp.head, [0, 0, 0]);
      place(p.nose, i, tmp.head, [0, -0.03, 0.335], [0, 0, 0], [1, 0.8, 0.8]);

      // cabelo: só as peças do estilo do boneco
      const hair = HAIR_PARTS[look.hairStyle];
      if (hair.includes('hairCap')) place(p.hairCap, i, tmp.head, [0, 0.04, -0.03], [-0.35, 0, 0]);
      else hide(p.hairCap, i);
      if (hair.includes('hairBun')) place(p.hairBun, i, tmp.head, [0, 0.34, -0.14]);
      else hide(p.hairBun, i);
      if (hair.includes('hairLong')) place(p.hairLong, i, tmp.head, [0, -0.17, -0.02]);
      else hide(p.hairLong, i);
      if (hair.includes('hairAfro')) place(p.hairAfro, i, tmp.head, [0, 0.14, -0.18], [0, 0, 0], [1.05, 0.95, 0.9]);
      else hide(p.hairAfro, i);
      SPIKES.forEach((spike, k) => {
        if (hair.includes('spikes')) place(p.spikes, i * SPIKES.length + k, tmp.head, spike.offset, spike.rot);
        else hide(p.spikes, i * SPIKES.length + k);
      });

      // rosto: olhos piscam, sobrancelhas sobem no "uau"
      const t = (now / 1000 + look.seed * 11) % BLINK_PERIOD_S;
      const eyeOpen = t < BLINK_S ? 0.12 : 1;
      const browLift = look.face === 'wow' ? 0.035 : 0;
      for (const side of [-1, 1] as const) {
        const k = i * 2 + (side < 0 ? 0 : 1);
        place(p.sclera, k, tmp.head, [side * 0.12, 0.03, 0.29], [0, 0, 0], [1, 1.2 * eyeOpen, 0.55]);
        place(p.pupils, k, tmp.head, [side * 0.115, 0.02, 0.325], [0, 0, 0], [1, 1.15 * eyeOpen, 0.6]);
        if (eyeOpen < 1) hide(p.shine, k);
        else place(p.shine, k, tmp.head, [side * 0.115 + 0.018, 0.05, 0.345]);
        place(p.brows, k, tmp.head, [side * 0.12, 0.15 + browLift, 0.3], [0, 0, Math.PI / 2 + side * (look.face === 'wow' ? 0.25 : 0.12)]);
        place(p.cheeks, k, tmp.head, [side * 0.2, -0.08, 0.26], [0, side * 0.5, 0], [1, 0.6, 0.4]);
      }
      if (look.face === 'wow') {
        place(p.wow, i, tmp.head, [0, -0.15, 0.31], [0, 0, 0], [1, 1.2, 0.6]);
        hide(p.smile, i);
      } else {
        const w = look.face === 'grin' ? 1.35 : 1;
        place(p.smile, i, tmp.head, [0, -0.1, 0.31], [0, 0, Math.PI], [w, w, 1]);
        hide(p.wow, i);
      }

      // chapéus (black power não usa chapéu) e coroa do host acima do cabelo
      for (const type of HAT_TYPES) {
        const h = HAT[type];
        if (!s.isHost && look.hat === type && look.hairStyle !== 'afro') place(p.hats[type], i, tmp.head, h.offset, h.rot, [h.scale, h.scale, h.scale]);
        else hide(p.hats[type], i);
      }
      if (s.isHost) place(p.crown, i, tmp.head, [0, look.hairStyle === 'afro' ? 0.62 : HEAD_R + 0.1, 0], [-0.12, 0, 0], [1.3, 1.3, 1.3]);
      else hide(p.crown, i);

      if (p.shadow) {
        tmp.o.position.set(ps.position[0], ps.position[1] + 0.02, ps.position[2]);
        tmp.o.rotation.set(-Math.PI / 2, 0, 0);
        tmp.o.scale.setScalar(Math.max(ps.scale, 0.0001));
        tmp.o.updateMatrix();
        p.shadow.setMatrixAt(i, tmp.o.matrix);
      }

      // cores: roupa brilha dourada na vitória; tudo fica lilás translúcido ao "virar fantasma" (desconectado)
      const paint = (meshes: (InstancedMesh | null)[], color: string, glow = 0) => {
        tmp.color.set(color).lerp(GHOST, ps.ghost).lerp(GOLD, glow);
        for (const m of meshes) m?.setColorAt(i, tmp.color);
      };
      const paintPair = (meshes: (InstancedMesh | null)[], color: string) => {
        tmp.color.set(color).lerp(GHOST, ps.ghost);
        for (const m of meshes) {
          m?.setColorAt(i * 2, tmp.color);
          m?.setColorAt(i * 2 + 1, tmp.color);
        }
      };
      paint([p.torso], look.body, ps.glow * 0.6);
      tmp.color.set(look.body).lerp(GHOST, ps.ghost).lerp(GOLD, ps.glow * 0.6);
      p.arms?.setColorAt(i * 2, tmp.color);
      p.arms?.setColorAt(i * 2 + 1, tmp.color);
      paint([p.head, p.nose], look.skin);
      paintPair([p.hands], look.skin);
      paint([p.hairCap, p.hairBun, p.hairLong, p.hairAfro], look.hair);
      paintPair([p.brows], look.hair);
      tmp.color.set(look.hair).lerp(GHOST, ps.ghost);
      for (let k = 0; k < SPIKES.length; k++) p.spikes?.setColorAt(i * SPIKES.length + k, tmp.color);
      paintPair([p.legs], look.pants);
      paint(
        HAT_TYPES.map((type) => p.hats[type]),
        look.accent,
      );
      p.crown?.setColorAt(i, GOLD);
    }

    for (const mesh of allMeshes(p)) {
      // Sala com 2 pessoas desenha 2 bonecos, não 32 escondidos em escala zero (que ainda custam vértices na GPU).
      mesh.count = states.length * perAvatar(p, mesh);
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      // A bounding sphere do InstancedMesh é calculada uma vez e não acompanha setMatrixAt:
      // zera para o raycast (toque no boneco) recalcular com as posições atuais.
      mesh.boundingSphere = null;
    }
  });

  const tap = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    const id = event.instanceId === undefined ? undefined : ids.current[event.instanceId];
    if (id) onTap(id);
  };

  const pair = MAX_AVATARS * 2;

  return (
    <group>
      {/* corpo */}
      <instancedMesh frustumCulled={false} ref={(m) => void (parts.current.torso = m)} args={[undefined, undefined, MAX_AVATARS]} castShadow={castShadow} onPointerDown={tap}>
        <capsuleGeometry args={[0.23, 0.2, 6, 16]} />
        <meshStandardMaterial roughness={0.6} />
      </instancedMesh>
      <instancedMesh frustumCulled={false} ref={(m) => void (parts.current.legs = m)} args={[undefined, undefined, pair]} castShadow={castShadow}>
        <capsuleGeometry args={[0.085, 0.14, 4, 10]} />
        <meshStandardMaterial roughness={0.7} />
      </instancedMesh>
      <instancedMesh frustumCulled={false} ref={(m) => void (parts.current.shoes = m)} args={[undefined, undefined, pair]}>
        <sphereGeometry args={[0.1, 12, 8]} />
        <meshStandardMaterial color="#111827" roughness={0.35} />
      </instancedMesh>
      <instancedMesh frustumCulled={false} ref={(m) => void (parts.current.arms = m)} args={[undefined, undefined, pair]} castShadow={castShadow}>
        <capsuleGeometry args={[0.065, 0.2, 4, 10]} />
        <meshStandardMaterial roughness={0.6} />
      </instancedMesh>
      <instancedMesh frustumCulled={false} ref={(m) => void (parts.current.hands = m)} args={[undefined, undefined, pair]}>
        <sphereGeometry args={[0.075, 12, 10]} />
        <meshStandardMaterial roughness={0.5} />
      </instancedMesh>

      {/* cabeça e rosto */}
      <instancedMesh frustumCulled={false} ref={(m) => void (parts.current.head = m)} args={[undefined, undefined, MAX_AVATARS]} castShadow={castShadow} onPointerDown={tap}>
        <sphereGeometry args={[HEAD_R, 28, 22]} />
        <meshStandardMaterial roughness={0.5} />
      </instancedMesh>
      <instancedMesh frustumCulled={false} ref={(m) => void (parts.current.nose = m)} args={[undefined, undefined, MAX_AVATARS]}>
        <sphereGeometry args={[0.04, 10, 8]} />
        <meshStandardMaterial roughness={0.5} />
      </instancedMesh>
      <instancedMesh frustumCulled={false} ref={(m) => void (parts.current.sclera = m)} args={[undefined, undefined, pair]}>
        <sphereGeometry args={[0.072, 14, 12]} />
        <meshStandardMaterial color="#ffffff" roughness={0.25} />
      </instancedMesh>
      <instancedMesh frustumCulled={false} ref={(m) => void (parts.current.pupils = m)} args={[undefined, undefined, pair]}>
        <sphereGeometry args={[0.045, 12, 10]} />
        <meshStandardMaterial color="#1e1b4b" roughness={0.15} />
      </instancedMesh>
      <instancedMesh frustumCulled={false} ref={(m) => void (parts.current.shine = m)} args={[undefined, undefined, pair]}>
        <sphereGeometry args={[0.016, 8, 6]} />
        <meshBasicMaterial color="#ffffff" />
      </instancedMesh>
      <instancedMesh frustumCulled={false} ref={(m) => void (parts.current.brows = m)} args={[undefined, undefined, pair]}>
        <capsuleGeometry args={[0.016, 0.07, 2, 6]} />
        <meshStandardMaterial roughness={0.6} />
      </instancedMesh>
      <instancedMesh frustumCulled={false} ref={(m) => void (parts.current.cheeks = m)} args={[undefined, undefined, pair]}>
        <sphereGeometry args={[0.06, 12, 8]} />
        <meshBasicMaterial color="#fb7185" transparent opacity={0.55} depthWrite={false} />
      </instancedMesh>
      <instancedMesh frustumCulled={false} ref={(m) => void (parts.current.smile = m)} args={[undefined, undefined, MAX_AVATARS]}>
        <torusGeometry args={[0.07, 0.016, 6, 16, Math.PI]} />
        <meshBasicMaterial color="#7f1d1d" />
      </instancedMesh>
      <instancedMesh frustumCulled={false} ref={(m) => void (parts.current.wow = m)} args={[undefined, undefined, MAX_AVATARS]}>
        <sphereGeometry args={[0.045, 10, 8]} />
        <meshBasicMaterial color="#7f1d1d" />
      </instancedMesh>

      {/* cabelos (um InstancedMesh por peça; cada boneco usa as do seu estilo) */}
      <instancedMesh frustumCulled={false} ref={(m) => void (parts.current.hairCap = m)} args={[undefined, undefined, MAX_AVATARS]}>
        {/* calota cobrindo o topo e a nuca, inclinada para trás deixando a testa livre */}
        <sphereGeometry args={[HEAD_R + 0.035, 28, 16, 0, Math.PI * 2, 0, Math.PI * 0.58]} />
        <meshStandardMaterial roughness={0.55} side={DoubleSide} />
      </instancedMesh>
      <instancedMesh frustumCulled={false} ref={(m) => void (parts.current.spikes = m)} args={[undefined, undefined, MAX_AVATARS * SPIKES.length]}>
        <coneGeometry args={[0.075, 0.22, 8]} />
        <meshStandardMaterial roughness={0.55} />
      </instancedMesh>
      <instancedMesh frustumCulled={false} ref={(m) => void (parts.current.hairBun = m)} args={[undefined, undefined, MAX_AVATARS]}>
        <sphereGeometry args={[0.14, 16, 12]} />
        <meshStandardMaterial roughness={0.55} />
      </instancedMesh>
      <instancedMesh frustumCulled={false} ref={(m) => void (parts.current.hairLong = m)} args={[undefined, undefined, MAX_AVATARS]}>
        {/* "cortina" atrás da cabeça descendo até os ombros */}
        <cylinderGeometry args={[HEAD_R + 0.03, HEAD_R + 0.08, 0.5, 20, 1, true, Math.PI / 2 - 0.3, Math.PI + 0.6]} />
        <meshStandardMaterial roughness={0.55} side={DoubleSide} />
      </instancedMesh>
      <instancedMesh frustumCulled={false} ref={(m) => void (parts.current.hairAfro = m)} args={[undefined, undefined, MAX_AVATARS]}>
        <icosahedronGeometry args={[HEAD_R + 0.1, 2]} />
        <meshStandardMaterial roughness={0.9} flatShading />
      </instancedMesh>

      {/* chapéus e coroa do host */}
      <instancedMesh frustumCulled={false} ref={(m) => void (parts.current.hats.tophat = m)} args={[undefined, undefined, MAX_AVATARS]}>
        <cylinderGeometry args={[0.17, 0.17, 0.3, 16]} />
        <meshStandardMaterial roughness={0.45} />
      </instancedMesh>
      <instancedMesh frustumCulled={false} ref={(m) => void (parts.current.hats.cap = m)} args={[undefined, undefined, MAX_AVATARS]}>
        <cylinderGeometry args={[0.27, 0.28, 0.1, 16]} />
        <meshStandardMaterial roughness={0.5} />
      </instancedMesh>
      <instancedMesh frustumCulled={false} ref={(m) => void (parts.current.hats.beanie = m)} args={[undefined, undefined, MAX_AVATARS]}>
        <sphereGeometry args={[0.27, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial roughness={0.8} />
      </instancedMesh>
      <instancedMesh frustumCulled={false} ref={(m) => void (parts.current.hats.party = m)} args={[undefined, undefined, MAX_AVATARS]}>
        <coneGeometry args={[0.14, 0.38, 16]} />
        <meshStandardMaterial roughness={0.45} />
      </instancedMesh>
      <instancedMesh frustumCulled={false} ref={(m) => void (parts.current.crown = m)} args={[undefined, undefined, MAX_AVATARS]}>
        <cylinderGeometry args={[0.2, 0.17, 0.18, 8, 1, true]} />
        <meshStandardMaterial metalness={0.8} roughness={0.25} side={DoubleSide} />
      </instancedMesh>
      {fakeShadow && (
        <instancedMesh frustumCulled={false} ref={(m) => void (parts.current.shadow = m)} args={[undefined, undefined, MAX_AVATARS]}>
          <circleGeometry args={[0.35, 16]} />
          <meshBasicMaterial color="#000000" transparent opacity={0.28} depthWrite={false} />
        </instancedMesh>
      )}
    </group>
  );
}

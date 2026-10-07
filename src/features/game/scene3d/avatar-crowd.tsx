'use client';

import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef, type RefObject } from 'react';
import { Color, DoubleSide, Euler, Matrix4, Object3D, Quaternion, Vector3, type InstancedMesh } from 'three';
import type { Hat } from './avatar-look';
import { pose, type AvatarState } from './pose';

export const MAX_AVATARS = 32; // 25 na sala + quem está saindo
type HatType = Exclude<Hat, 'none'>;
const HAT_TYPES: HatType[] = ['tophat', 'cap', 'beanie', 'party'];
const GHOST = new Color('#c4b5fd');
const GOLD = new Color('#facc15');
const WHITE = new Color('#ffffff');
const ZERO = new Matrix4().makeScale(0, 0, 0);

/** Proporção "chibi": cabeça grande em cima de um corpo pequeno. */
const HEAD_Y = 1.06;
const HEAD_R = 0.34;
const HAT: Record<HatType, { offset: [number, number, number]; rot: [number, number, number]; scale: number }> = {
  tophat: { offset: [0, 0.5, -0.02], rot: [-0.08, 0, 0], scale: 1.2 },
  cap: { offset: [0, 0.29, 0], rot: [-0.18, 0, 0], scale: 1.3 },
  beanie: { offset: [0, 0.07, -0.01], rot: [-0.1, 0, 0], scale: 1.36 },
  party: { offset: [0, 0.54, 0], rot: [-0.12, 0, 0.12], scale: 1.15 },
};

type Parts = {
  torso: InstancedMesh | null;
  legs: InstancedMesh | null;
  shoes: InstancedMesh | null;
  arms: InstancedMesh | null;
  hands: InstancedMesh | null;
  head: InstancedMesh | null;
  hair: InstancedMesh | null;
  eyes: InstancedMesh | null;
  shine: InstancedMesh | null;
  cheeks: InstancedMesh | null;
  smile: InstancedMesh | null;
  wow: InstancedMesh | null;
  crown: InstancedMesh | null;
  shadow: InstancedMesh | null;
  hats: Record<HatType, InstancedMesh | null>;
};

/** Peças com 2 instâncias por boneco (pares). */
const PAIRED: (keyof Omit<Parts, 'hats'>)[] = ['legs', 'shoes', 'arms', 'hands', 'eyes', 'shine', 'cheeks'];

function allMeshes(p: Parts): InstancedMesh[] {
  const { hats, ...rest } = p;
  return [...Object.values(rest), ...Object.values(hats)].filter((m): m is InstancedMesh => m !== null);
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
    torso: null,
    legs: null,
    shoes: null,
    arms: null,
    hands: null,
    head: null,
    hair: null,
    eyes: null,
    shine: null,
    cheeks: null,
    smile: null,
    wow: null,
    crown: null,
    shadow: null,
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

    const compose = (out: Matrix4, parent: Matrix4, offset: [number, number, number], rot: [number, number, number], scale: [number, number, number]) => {
      tmp.local.compose(tmp.v.set(...offset), tmp.q.setFromEuler(tmp.e.set(...rot)), tmp.s.set(...scale));
      out.multiplyMatrices(parent, tmp.local);
    };
    /** out = parent × T(offset) × R(rot) × S(scale) */
    const place = (mesh: InstancedMesh | null, index: number, parent: Matrix4, offset: [number, number, number], rot: [number, number, number] = [0, 0, 0], scale: [number, number, number] = [1, 1, 1]) => {
      if (!mesh) return;
      compose(tmp.out, parent, offset, rot, scale);
      mesh.setMatrixAt(index, tmp.out);
    };

    for (let i = 0; i < MAX_AVATARS; i++) {
      const s = states[i];
      if (!s) {
        const { hats, ...rest } = p;
        for (const [key, mesh] of Object.entries(rest) as [keyof typeof rest, InstancedMesh | null][]) {
          if (!mesh) continue;
          if (PAIRED.includes(key)) {
            mesh.setMatrixAt(i * 2, ZERO);
            mesh.setMatrixAt(i * 2 + 1, ZERO);
          } else mesh.setMatrixAt(i, ZERO);
        }
        for (const mesh of Object.values(hats)) mesh?.setMatrixAt(i, ZERO);
        continue;
      }
      const ps = pose(s, now);
      tmp.base.compose(tmp.v.set(...ps.position), tmp.q.setFromEuler(tmp.e.set(0, ps.rotationY, 0)), tmp.s.setScalar(Math.max(ps.scale, 0.0001)));

      // corpo
      place(p.torso, i, tmp.base, [0, 0.5, 0], [0, 0, 0], [1, 1, 0.9]);
      for (const side of [-1, 1] as const) {
        const k = side < 0 ? 0 : 1;
        // pernas balançam opostas aos braços; sapato acompanha a perna
        compose(tmp.limb, tmp.base, [side * 0.11, 0.3, 0], [side * ps.armSwing * 0.35, 0, 0], [1, 1, 1]);
        place(p.legs, i * 2 + k, tmp.limb, [0, -0.12, 0]);
        place(p.shoes, i * 2 + k, tmp.limb, [0, -0.25, 0.04], [0, 0, 0], [1, 0.6, 1.35]);
        // braço gira no ombro; mão na ponta
        const raise = side > 0 ? ps.armRaise * (2.6 + ps.armSwing) : 0;
        compose(tmp.limb, tmp.base, [side * 0.27, 0.66, 0], [-side * ps.armSwing * 0.5, 0, side * (0.25 + raise)], [1, 1, 1]);
        place(p.arms, i * 2 + k, tmp.limb, [0, -0.13, 0]);
        place(p.hands, i * 2 + k, tmp.limb, [0, -0.28, 0]);
      }

      // cabeça e tudo que vai nela gira junto (headYaw)
      tmp.local.compose(tmp.v.set(0, HEAD_Y, 0), tmp.q.setFromEuler(tmp.e.set(0, ps.headYaw, 0)), tmp.s.set(1, 1, 1));
      tmp.head.multiplyMatrices(tmp.base, tmp.local);
      place(p.head, i, tmp.head, [0, 0, 0]);
      place(p.hair, i, tmp.head, [0, 0.04, -0.03], [-0.35, 0, 0]);
      for (const side of [-1, 1] as const) {
        const k = side < 0 ? 0 : 1;
        place(p.eyes, i * 2 + k, tmp.head, [side * 0.12, 0.02, 0.3], [0, 0, 0], [1, 1.3, 0.6]);
        place(p.shine, i * 2 + k, tmp.head, [side * 0.12 + 0.02, 0.06, 0.335]);
        place(p.cheeks, i * 2 + k, tmp.head, [side * 0.2, -0.08, 0.26], [0, side * 0.5, 0], [1, 0.6, 0.4]);
      }
      if (s.look.face === 'wow') {
        place(p.wow, i, tmp.head, [0, -0.13, 0.31]);
        p.smile?.setMatrixAt(i, ZERO);
      } else {
        const w = s.look.face === 'grin' ? 1.35 : 1;
        place(p.smile, i, tmp.head, [0, -0.08, 0.31], [0, 0, Math.PI], [w, w, 1]);
        p.wow?.setMatrixAt(i, ZERO);
      }

      for (const type of HAT_TYPES) {
        const mesh = p.hats[type];
        const h = HAT[type];
        if (!s.isHost && s.look.hat === type) place(mesh, i, tmp.head, h.offset, h.rot, [h.scale, h.scale, h.scale]);
        else mesh?.setMatrixAt(i, ZERO);
      }
      if (s.isHost) place(p.crown, i, tmp.head, [0, HEAD_R + 0.08, 0], [-0.12, 0, 0], [1.3, 1.3, 1.3]);
      else p.crown?.setMatrixAt(i, ZERO);

      if (p.shadow) {
        tmp.o.position.set(ps.position[0], ps.position[1] + 0.02, ps.position[2]);
        tmp.o.rotation.set(-Math.PI / 2, 0, 0);
        tmp.o.scale.setScalar(Math.max(ps.scale, 0.0001));
        tmp.o.updateMatrix();
        p.shadow.setMatrixAt(i, tmp.o.matrix);
      }

      // cores: roupa brilha dourada na vitória; tudo fica lilás translúcido ao "virar fantasma" (desconectado)
      tmp.color.set(s.look.body).lerp(GHOST, ps.ghost).lerp(GOLD, ps.glow * 0.6);
      p.torso?.setColorAt(i, tmp.color);
      p.arms?.setColorAt(i * 2, tmp.color);
      p.arms?.setColorAt(i * 2 + 1, tmp.color);
      tmp.color.set(s.look.skin).lerp(GHOST, ps.ghost);
      p.head?.setColorAt(i, tmp.color);
      p.hands?.setColorAt(i * 2, tmp.color);
      p.hands?.setColorAt(i * 2 + 1, tmp.color);
      tmp.color.set(s.look.hair).lerp(GHOST, ps.ghost);
      p.hair?.setColorAt(i, tmp.color);
      tmp.color.set(s.look.pants).lerp(GHOST, ps.ghost);
      p.legs?.setColorAt(i * 2, tmp.color);
      p.legs?.setColorAt(i * 2 + 1, tmp.color);
      tmp.color.set(s.look.accent).lerp(GHOST, ps.ghost);
      for (const type of HAT_TYPES) p.hats[type]?.setColorAt(i, tmp.color);
      p.crown?.setColorAt(i, GOLD);
    }

    for (const mesh of allMeshes(p)) {
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

      {/* cabeça */}
      <instancedMesh frustumCulled={false} ref={(m) => void (parts.current.head = m)} args={[undefined, undefined, MAX_AVATARS]} castShadow={castShadow} onPointerDown={tap}>
        <sphereGeometry args={[HEAD_R, 28, 22]} />
        <meshStandardMaterial roughness={0.5} />
      </instancedMesh>
      <instancedMesh frustumCulled={false} ref={(m) => void (parts.current.hair = m)} args={[undefined, undefined, MAX_AVATARS]}>
        {/* calota cobrindo o topo e a nuca, inclinada para trás deixando a testa livre */}
        <sphereGeometry args={[HEAD_R + 0.035, 28, 16, 0, Math.PI * 2, 0, Math.PI * 0.58]} />
        <meshStandardMaterial roughness={0.55} side={DoubleSide} />
      </instancedMesh>
      <instancedMesh frustumCulled={false} ref={(m) => void (parts.current.eyes = m)} args={[undefined, undefined, pair]}>
        <sphereGeometry args={[0.055, 12, 10]} />
        <meshStandardMaterial color="#0f172a" roughness={0.2} />
      </instancedMesh>
      <instancedMesh frustumCulled={false} ref={(m) => void (parts.current.shine = m)} args={[undefined, undefined, pair]}>
        <sphereGeometry args={[0.018, 8, 6]} />
        <meshBasicMaterial color="#ffffff" />
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

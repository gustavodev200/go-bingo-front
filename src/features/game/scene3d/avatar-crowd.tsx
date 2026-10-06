'use client';

import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef, type RefObject } from 'react';
import { Color, DoubleSide, Euler, Matrix4, Object3D, Quaternion, Vector3, type InstancedMesh } from 'three';
import type { Face, Hat } from './avatar-look';
import { pose, type AvatarState } from './pose';

export const MAX_AVATARS = 32; // 25 na sala + quem está saindo
type HatType = Exclude<Hat, 'none'>;
const HAT_TYPES: HatType[] = ['tophat', 'cap', 'beanie', 'party'];
const GHOST = new Color('#c4b5fd');
const GOLD = new Color('#facc15');
const WHITE = new Color('#ffffff');
const ZERO = new Matrix4().makeScale(0, 0, 0);
const MOUTH: Record<Face, [number, number, number]> = {
  smile: [0.1, 0.03, 0.04],
  grin: [0.15, 0.045, 0.04],
  wow: [0.055, 0.06, 0.04],
};

type Parts = {
  body: InstancedMesh | null;
  head: InstancedMesh | null;
  arms: InstancedMesh | null;
  eyes: InstancedMesh | null;
  mouth: InstancedMesh | null;
  crown: InstancedMesh | null;
  shadow: InstancedMesh | null;
  hats: Record<HatType, InstancedMesh | null>;
};

function allMeshes(p: Parts): InstancedMesh[] {
  return [p.body, p.head, p.arms, p.eyes, p.mouth, p.crown, p.shadow, ...Object.values(p.hats)].filter((m): m is InstancedMesh => m !== null);
}

/** Bonecos "brinquedo de vinil": 1 InstancedMesh por peça (~11 draw calls para toda a plateia). */
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
  const parts = useRef<Parts>({ body: null, head: null, arms: null, eyes: null, mouth: null, crown: null, shadow: null, hats: { tophat: null, cap: null, beanie: null, party: null } });
  const ids = useRef<string[]>([]);
  const tmp = useMemo(
    () => ({ o: new Object3D(), base: new Matrix4(), head: new Matrix4(), local: new Matrix4(), out: new Matrix4(), q: new Quaternion(), e: new Euler(), v: new Vector3(), s: new Vector3(), color: new Color() }),
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

    /** out = parent × T(offset) × R(rot) × S(scale) */
    const place = (mesh: InstancedMesh | null, index: number, parent: Matrix4, offset: [number, number, number], rot: [number, number, number], scale: [number, number, number] = [1, 1, 1]) => {
      if (!mesh) return;
      tmp.local.compose(tmp.v.set(...offset), tmp.q.setFromEuler(tmp.e.set(...rot)), tmp.s.set(...scale));
      tmp.out.multiplyMatrices(parent, tmp.local);
      mesh.setMatrixAt(index, tmp.out);
    };

    for (let i = 0; i < MAX_AVATARS; i++) {
      const s = states[i];
      if (!s) {
        for (const mesh of [p.body, p.head, p.mouth, p.crown, p.shadow, ...Object.values(p.hats)]) mesh?.setMatrixAt(i, ZERO);
        for (const mesh of [p.arms, p.eyes]) {
          mesh?.setMatrixAt(i * 2, ZERO);
          mesh?.setMatrixAt(i * 2 + 1, ZERO);
        }
        continue;
      }
      const ps = pose(s, now);
      tmp.base.compose(tmp.v.set(...ps.position), tmp.q.setFromEuler(tmp.e.set(0, ps.rotationY, 0)), tmp.s.setScalar(Math.max(ps.scale, 0.0001)));

      place(p.body, i, tmp.base, [0, 0.5, 0], [0, 0, 0]);
      place(p.arms, i * 2, tmp.base, [-0.33, 0.6, 0], [ps.armSwing * 0.5, 0, 0.18]);
      place(p.arms, i * 2 + 1, tmp.base, [0.33, 0.6, 0], [-ps.armSwing * 0.5, 0, -0.18 + ps.armRaise * (2.6 + ps.armSwing)]);

      // cabeça e tudo que vai nela gira junto (headYaw)
      tmp.local.compose(tmp.v.set(0, 1.08, 0), tmp.q.setFromEuler(tmp.e.set(0, ps.headYaw, 0)), tmp.s.set(1, 1, 1));
      tmp.head.multiplyMatrices(tmp.base, tmp.local);
      place(p.head, i, tmp.head, [0, 0, 0], [0, 0, 0]);
      place(p.eyes, i * 2, tmp.head, [-0.09, 0.05, 0.22], [0, 0, 0]);
      place(p.eyes, i * 2 + 1, tmp.head, [0.09, 0.05, 0.22], [0, 0, 0]);
      place(p.mouth, i, tmp.head, [0, -0.08, 0.23], [0, 0, 0], MOUTH[s.look.face]);

      for (const type of HAT_TYPES) {
        const mesh = p.hats[type];
        if (!s.isHost && s.look.hat === type) place(mesh, i, tmp.head, [0, 0.24, 0], type === 'cap' ? [-0.15, 0, 0] : [0, 0, 0]);
        else mesh?.setMatrixAt(i, ZERO);
      }
      if (s.isHost) place(p.crown, i, tmp.head, [0, 0.28, 0], [0, 0, 0]);
      else p.crown?.setMatrixAt(i, ZERO);

      if (p.shadow) {
        tmp.o.position.set(ps.position[0], ps.position[1] + 0.02, ps.position[2]);
        tmp.o.rotation.set(-Math.PI / 2, 0, 0);
        tmp.o.scale.setScalar(Math.max(ps.scale, 0.0001));
        tmp.o.updateMatrix();
        p.shadow.setMatrixAt(i, tmp.o.matrix);
      }

      tmp.color.set(s.look.body).lerp(GHOST, ps.ghost);
      p.body?.setColorAt(i, tmp.color);
      p.head?.setColorAt(i, tmp.color);
      p.arms?.setColorAt(i * 2, tmp.color);
      p.arms?.setColorAt(i * 2 + 1, tmp.color);
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

  return (
    <group>
      <instancedMesh frustumCulled={false} ref={(m) => void (parts.current.body = m)} args={[undefined, undefined, MAX_AVATARS]} castShadow={castShadow} onPointerDown={tap}>
        <capsuleGeometry args={[0.28, 0.35, 4, 8]} />
        <meshStandardMaterial flatShading roughness={0.5} />
      </instancedMesh>
      <instancedMesh frustumCulled={false} ref={(m) => void (parts.current.head = m)} args={[undefined, undefined, MAX_AVATARS]} castShadow={castShadow} onPointerDown={tap}>
        <sphereGeometry args={[0.26, 10, 8]} />
        <meshStandardMaterial flatShading roughness={0.4} />
      </instancedMesh>
      <instancedMesh frustumCulled={false} ref={(m) => void (parts.current.arms = m)} args={[undefined, undefined, MAX_AVATARS * 2]}>
        <capsuleGeometry args={[0.07, 0.3, 2, 6]} />
        <meshStandardMaterial flatShading />
      </instancedMesh>
      <instancedMesh frustumCulled={false} ref={(m) => void (parts.current.eyes = m)} args={[undefined, undefined, MAX_AVATARS * 2]}>
        <sphereGeometry args={[0.045, 6, 6]} />
        <meshBasicMaterial color="#0f172a" />
      </instancedMesh>
      <instancedMesh frustumCulled={false} ref={(m) => void (parts.current.mouth = m)} args={[undefined, undefined, MAX_AVATARS]}>
        <sphereGeometry args={[1, 8, 6]} />
        <meshBasicMaterial color="#7f1d1d" />
      </instancedMesh>
      <instancedMesh frustumCulled={false} ref={(m) => void (parts.current.hats.tophat = m)} args={[undefined, undefined, MAX_AVATARS]}>
        <cylinderGeometry args={[0.17, 0.17, 0.3, 10]} />
        <meshStandardMaterial flatShading />
      </instancedMesh>
      <instancedMesh frustumCulled={false} ref={(m) => void (parts.current.hats.cap = m)} args={[undefined, undefined, MAX_AVATARS]}>
        <cylinderGeometry args={[0.27, 0.28, 0.1, 12]} />
        <meshStandardMaterial flatShading />
      </instancedMesh>
      <instancedMesh frustumCulled={false} ref={(m) => void (parts.current.hats.beanie = m)} args={[undefined, undefined, MAX_AVATARS]}>
        <sphereGeometry args={[0.27, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial flatShading />
      </instancedMesh>
      <instancedMesh frustumCulled={false} ref={(m) => void (parts.current.hats.party = m)} args={[undefined, undefined, MAX_AVATARS]}>
        <coneGeometry args={[0.14, 0.38, 8]} />
        <meshStandardMaterial flatShading />
      </instancedMesh>
      <instancedMesh frustumCulled={false} ref={(m) => void (parts.current.crown = m)} args={[undefined, undefined, MAX_AVATARS]}>
        <cylinderGeometry args={[0.2, 0.17, 0.18, 6, 1, true]} />
        <meshStandardMaterial metalness={0.6} roughness={0.3} side={DoubleSide} />
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

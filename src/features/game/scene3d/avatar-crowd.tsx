'use client';

import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef, type ReactNode, type Ref, type RefObject } from 'react';
import { Color, DoubleSide, Euler, Matrix4, Object3D, Quaternion, Vector3, type BufferGeometry, type InstancedMesh, type Side } from 'three';
import { HAIR_STYLES, type Face, type HairStyle } from './avatar-look';
import { FACE, HAT_TYPES, HEAD_Y, characterShader, createAvatarGeometries, disposeAvatarGeometries, type HatType, type V3 } from './avatar-geometry';
import { PHASE_MS, WAVE_MS, pose, type AvatarState } from './pose';

export const MAX_AVATARS = 32; // 25 na sala + quem está saindo
const GHOST = new Color('#c4b5fd');
const GOLD = new Color('#facc15');
const WHITE = new Color('#ffffff');
const ZERO = new Matrix4().makeScale(0, 0, 0);
const NONE: V3 = [0, 0, 0];
const SIDES = [-1, 1] as const;

/** Cintura: o tronco inclina/balança a partir daqui; quadril e pernas ficam no chão. */
const WAIST_Y = 0.32;
const FROM_WAIST = new Matrix4().makeTranslation(0, -WAIST_Y, 0);
const SHOULDER: V3 = [0.235, 0.665, 0];
const ELBOW_Y = -0.09;
const HIP: V3 = [0.105, 0.3, 0];
/** Piscar: a cada ~4 s, 120 ms de olho fechado; fase diferente por boneco. */
const BLINK_PERIOD_S = 4.2;
const BLINK_S = 0.12;

/** Expressão do momento: a escolhida pelo id, trocada pela fase (vitória, "por 1", fantasma). */
type Mood = Face | 'happy' | 'sleepy';
/** Sobrancelha: `tilt` > 0 sobe a ponta de dentro (simpatia/surpresa/tristeza). */
const BROW: Record<Mood, { lift: number; tilt: number }> = {
  smile: { lift: 0, tilt: 0.06 },
  grin: { lift: 0.012, tilt: 0.1 },
  wow: { lift: 0.03, tilt: 0.16 },
  happy: { lift: 0.02, tilt: 0.12 },
  sleepy: { lift: -0.006, tilt: 0.3 },
};

type Single = 'torso' | 'hips' | 'collar' | 'head' | 'mouthSmile' | 'mouthOpen' | 'mouthWow' | 'crown' | 'shadow';
type Paired = 'legs' | 'shoes' | 'arms' | 'hands' | 'eyes' | 'lids' | 'brows' | 'cheeks';
type Parts = Record<Single | Paired, InstancedMesh | null> & { hair: Record<HairStyle, InstancedMesh | null>; hats: Record<HatType, InstancedMesh | null> };

function allMeshes(p: Parts): InstancedMesh[] {
  const { hair, hats, ...rest } = p;
  return [...Object.values(rest), ...Object.values(hair), ...Object.values(hats)].filter((m): m is InstancedMesh => m !== null);
}

const colors = new Map<string, Color>();
const cached = (hex: string) => {
  let color = colors.get(hex);
  if (!color) colors.set(hex, (color = new Color(hex)));
  return color;
};

/**
 * Bonecos chibi (pele, cabelo, roupa e rosto derivados do id): 1 InstancedMesh por peça para toda a plateia.
 * Cada peça só desenha as instâncias em uso — cabelos, chapéus e bocas que ninguém está usando nem vão para a GPU.
 */
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
    ...(Object.fromEntries(
      (['torso', 'hips', 'collar', 'head', 'mouthSmile', 'mouthOpen', 'mouthWow', 'crown', 'shadow', 'legs', 'shoes', 'arms', 'hands', 'eyes', 'lids', 'brows', 'cheeks'] as const).map((k) => [k, null]),
    ) as Record<Single | Paired, null>),
    hair: { short: null, spiky: null, bun: null, long: null, afro: null },
    hats: { tophat: null, cap: null, beanie: null, party: null },
  });
  const ids = useRef<string[]>([]);
  const geo = useMemo(() => createAvatarGeometries(), []);
  useEffect(() => () => disposeAvatarGeometries(geo), [geo]);
  const tmp = useMemo(
    () => ({
      o: new Object3D(),
      base: new Matrix4(),
      upper: new Matrix4(),
      head: new Matrix4(),
      face: new Matrix4(),
      limb: new Matrix4(),
      elbow: new Matrix4(),
      local: new Matrix4(),
      out: new Matrix4(),
      q: new Quaternion(),
      e: new Euler(),
      v: new Vector3(),
      s: new Vector3(),
      color: new Color(),
      used: new Map<InstancedMesh, number>(),
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
    const t = now / 1000;
    const states = [...(statesRef.current?.values() ?? [])].slice(0, MAX_AVATARS);
    ids.current = states.map((s) => s.userId);
    const used = tmp.used;
    used.clear();

    /** Próxima instância livre da peça. Torso e cabeça recebem 1 por boneco, na ordem: o índice é o do boneco (toque). */
    const put = (mesh: InstancedMesh | null, matrix: Matrix4, color?: Color) => {
      if (!mesh) return;
      const index = used.get(mesh) ?? 0;
      mesh.setMatrixAt(index, matrix);
      if (color) mesh.setColorAt(index, color);
      used.set(mesh, index + 1);
    };
    /** out = parent × T(offset) × R(rot) × S(scale) */
    const at = (out: Matrix4, parent: Matrix4, offset: V3, rot: V3 = NONE, scale?: V3) => {
      tmp.local.compose(tmp.v.set(...offset), tmp.q.setFromEuler(tmp.e.set(...rot)), scale ? tmp.s.set(...scale) : tmp.s.setScalar(1));
      return out.multiplyMatrices(parent, tmp.local);
    };
    /** Lilás ao virar fantasma (desconectado), dourado no brilho de "por 1"/vitória. */
    const tint = (hex: string, ghost: number, glow = 0) => tmp.color.copy(cached(hex)).lerp(GHOST, ghost).lerp(GOLD, glow);

    for (const s of states) {
      const ps = pose(s, now);
      const look = s.look;
      const ghost = ps.ghost;
      const glow = ps.glow * 0.6;
      const phase = look.seed * Math.PI * 2;
      const elapsed = now - s.phaseStart;
      const walking = (s.phase === 'entering' && elapsed < PHASE_MS.entering) || (s.phase === 'leaving' && elapsed >= WAVE_MS);
      const celebrating = s.phase === 'winner' || s.phase === 'dance';
      const mood: Mood = celebrating ? 'happy' : ghost > 0.5 ? 'sleepy' : s.oneAway ? 'wow' : s.phase === 'ready-jump' ? 'grin' : look.face;

      // estica na velocidade vertical (pulos) e encolhe a largura junto: volume constante, pulo menos "duro"
      const vy = (ps.position[1] - pose(s, now - 32).position[1]) / 0.032;
      const stretch = Math.min(Math.abs(vy) * 0.03, 0.14);
      const scale = Math.max(ps.scale, 0.0001);
      const wide = scale / Math.sqrt(1 + stretch);
      tmp.base.compose(tmp.v.set(...ps.position), tmp.q.setFromEuler(tmp.e.set(0, ps.rotationY, 0)), tmp.s.set(wide, scale * (1 + stretch), wide));

      // tronco: inclina para frente ao andar e balança de leve (mais solto no fantasma e na comemoração)
      const lean = walking ? 0.14 : 0;
      const sway = ghost > 0 ? 0.08 * Math.sin(t * 1.4 + phase) : celebrating ? 0.12 * Math.sin(t * 9) : 0.035 * Math.sin(t * 0.9 + phase);
      at(tmp.upper, tmp.base, [0, WAIST_Y, 0], [lean, 0, sway]).multiply(FROM_WAIST);

      put(p.torso, tmp.upper, tint(look.body, ghost, glow));
      put(p.collar, tmp.upper, tint(look.accent, ghost));
      put(p.hips, tmp.base, tint(look.pants, ghost));

      for (const side of SIDES) {
        // pernas balançam opostas aos braços; o tênis já vem pendurado na perna
        at(tmp.limb, tmp.base, [side * HIP[0], HIP[1], 0], [walking ? side * ps.armSwing * 0.9 : 0, 0, 0]);
        put(p.legs, tmp.limb, tint(look.pants, ghost));
        put(p.shoes, tmp.limb);

        // braço gira no ombro (o direito acena; na comemoração os dois sobem); antebraço dobra no cotovelo
        const raised = side > 0 || celebrating ? ps.armRaise : 0;
        const hang = 0.2 + 0.03 * Math.sin(t * 1.1 + phase) + ghost * 0.55;
        at(tmp.limb, tmp.upper, [side * SHOULDER[0], SHOULDER[1], 0], [-side * ps.armSwing * (walking ? 0.9 : 0.5), 0, side * (hang + raised * (2.6 + side * ps.armSwing))]);
        put(p.arms, tmp.limb, tint(look.body, ghost, glow));
        at(tmp.elbow, tmp.limb, [0, ELBOW_Y, 0], [walking ? -0.45 : raised ? -0.2 : -0.15, 0, raised ? -side * 0.3 : 0]);
        put(p.hands, tmp.elbow, tint(look.skin, ghost));
      }

      // cabeça: inclina e acena junto com o humor; tudo do rosto/cabelo vai com ela
      const nod = ghost > 0 ? 0.2 : walking ? 0.05 * Math.abs(Math.sin(t * 8)) : s.oneAway ? -0.1 : 0;
      const tilt = celebrating ? 0.16 * Math.sin(t * 7) : ghost > 0 ? 0.18 : 0.06 * Math.sin(t * 0.55 + phase * 3);
      at(tmp.head, tmp.upper, [0, HEAD_Y, 0], [nod, ps.headYaw, tilt]);
      put(p.head, tmp.head, tint(look.skin, ghost));

      // chapéu (black power não usa) por cima do cabelo; sob chapéu os espetos atravessariam a aba → cabelo curto
      const hat = !s.isHost && look.hat !== 'none' && look.hairStyle !== 'afro' ? look.hat : null;
      put(p.hair[hat && look.hairStyle === 'spiky' ? 'short' : look.hairStyle], tmp.head, tint(look.hair, ghost));
      if (hat) put(p.hats[hat], tmp.head, tint(look.accent, ghost));
      if (s.isHost) put(p.crown, at(tmp.out, tmp.head, [0, look.hairStyle === 'afro' ? 0.64 : 0.44, 0], [-0.12, 0, 0], [1.3, 1.3, 1.3]));

      // rosto: olhos piscam (ou fecham felizes/sonolentos), sobrancelhas e boca seguem o humor
      const blink = (t + look.seed * 11) % BLINK_PERIOD_S < BLINK_S;
      const shut = blink || mood === 'happy' || mood === 'sleepy';
      const eye = mood === 'wow' ? 1.12 : 1;
      const brow = BROW[mood];
      SIDES.forEach((side, k) => {
        tmp.face.multiplyMatrices(tmp.head, FACE.eye[k]);
        if (shut) put(p.lids, at(tmp.out, tmp.face, NONE, [0, 0, mood === 'happy' ? 0 : Math.PI]));
        else put(p.eyes, at(tmp.out, tmp.face, NONE, NONE, [eye, eye, 1]));
        tmp.face.multiplyMatrices(tmp.head, FACE.brow[k]);
        put(p.brows, at(tmp.out, tmp.face, [0, brow.lift, 0], [0, 0, -side * brow.tilt]), tint(look.hair, ghost));
        put(p.cheeks, tmp.face.multiplyMatrices(tmp.head, FACE.cheek[k]));
      });
      tmp.face.multiplyMatrices(tmp.head, FACE.mouth);
      if (mood === 'wow') put(p.mouthWow, at(tmp.out, tmp.face, NONE, NONE, [1, 1 + 0.1 * Math.sin(t * 7), 1]));
      else if (mood === 'grin' || mood === 'happy') put(p.mouthOpen, mood === 'happy' ? at(tmp.out, tmp.face, NONE, NONE, [1.15, 1.15, 1]) : tmp.face);
      else put(p.mouthSmile, mood === 'sleepy' ? at(tmp.out, tmp.face, NONE, NONE, [0.7, 0.6, 1]) : tmp.face);

      if (p.shadow) {
        tmp.o.position.set(ps.position[0], ps.position[1] + 0.02, ps.position[2]);
        tmp.o.rotation.set(-Math.PI / 2, 0, 0);
        tmp.o.scale.setScalar(scale);
        tmp.o.updateMatrix();
        put(p.shadow, tmp.o.matrix);
      }
    }

    for (const mesh of allMeshes(p)) {
      // Desenha só as instâncias em uso: sala com 2 pessoas = 2 bonecos; peça sem uso nem entra no draw.
      mesh.count = used.get(mesh) ?? 0;
      mesh.visible = mesh.count > 0;
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
      {/* corpo: camisa, gola, calça, braços e pernas */}
      <Part ref={(m) => void (parts.current.torso = m)} geometry={geo.torso} count={MAX_AVATARS} castShadow={castShadow} onPointerDown={tap}>
        <Lit roughness={0.75} />
      </Part>
      <Part ref={(m) => void (parts.current.collar = m)} geometry={geo.collar} count={MAX_AVATARS}>
        <Lit roughness={0.6} />
      </Part>
      <Part ref={(m) => void (parts.current.hips = m)} geometry={geo.hips} count={MAX_AVATARS}>
        <Lit roughness={0.8} />
      </Part>
      <Part ref={(m) => void (parts.current.legs = m)} geometry={geo.legs} count={pair} castShadow={castShadow}>
        <Lit roughness={0.8} />
      </Part>
      <Part ref={(m) => void (parts.current.shoes = m)} geometry={geo.shoes} count={pair}>
        <Lit roughness={0.4} />
      </Part>
      <Part ref={(m) => void (parts.current.arms = m)} geometry={geo.arms} count={pair} castShadow={castShadow}>
        <Lit roughness={0.75} />
      </Part>
      <Part ref={(m) => void (parts.current.hands = m)} geometry={geo.hands} count={pair}>
        <Lit roughness={0.55} />
      </Part>

      {/* cabeça (orelhas e nariz inclusos) e rosto */}
      <Part ref={(m) => void (parts.current.head = m)} geometry={geo.head} count={MAX_AVATARS} castShadow={castShadow} onPointerDown={tap}>
        <Lit roughness={0.55} />
      </Part>
      <Part ref={(m) => void (parts.current.eyes = m)} geometry={geo.eyes} count={pair}>
        <Lit roughness={0.2} />
      </Part>
      <Part ref={(m) => void (parts.current.lids = m)} geometry={geo.lids} count={pair}>
        <meshBasicMaterial vertexColors />
      </Part>
      <Part ref={(m) => void (parts.current.brows = m)} geometry={geo.brows} count={pair}>
        <Lit roughness={0.7} />
      </Part>
      <Part ref={(m) => void (parts.current.cheeks = m)} geometry={geo.cheeks} count={pair}>
        <meshBasicMaterial color="#fb7185" transparent opacity={0.45} depthWrite={false} />
      </Part>
      <Part ref={(m) => void (parts.current.mouthSmile = m)} geometry={geo.mouths.smile} count={MAX_AVATARS}>
        <meshBasicMaterial vertexColors />
      </Part>
      <Part ref={(m) => void (parts.current.mouthOpen = m)} geometry={geo.mouths.open} count={MAX_AVATARS}>
        <meshBasicMaterial vertexColors />
      </Part>
      <Part ref={(m) => void (parts.current.mouthWow = m)} geometry={geo.mouths.wow} count={MAX_AVATARS}>
        <meshBasicMaterial vertexColors />
      </Part>

      {/* cabelos e chapéus: uma peça por estilo; cada boneco usa só a sua */}
      {HAIR_STYLES.map((style) => (
        <Part key={style} ref={(m) => void (parts.current.hair[style] = m)} geometry={geo.hair[style]} count={MAX_AVATARS}>
          <Lit roughness={0.5} side={DoubleSide} />
        </Part>
      ))}
      {HAT_TYPES.map((type) => (
        <Part key={type} ref={(m) => void (parts.current.hats[type] = m)} geometry={geo.hats[type]} count={MAX_AVATARS}>
          <Lit roughness={0.55} side={DoubleSide} />
        </Part>
      ))}
      <Part ref={(m) => void (parts.current.crown = m)} geometry={geo.crown} count={MAX_AVATARS}>
        <Lit roughness={0.25} metalness={0.8} side={DoubleSide} />
      </Part>
      {fakeShadow && (
        <Part ref={(m) => void (parts.current.shadow = m)} geometry={geo.shadow} count={MAX_AVATARS}>
          <meshBasicMaterial color="#000000" transparent opacity={0.28} depthWrite={false} />
        </Part>
      )}
    </group>
  );
}

function Part({
  ref,
  geometry,
  count,
  children,
  ...props
}: {
  ref: Ref<InstancedMesh>;
  geometry: BufferGeometry;
  count: number;
  children: ReactNode;
  castShadow?: boolean;
  onPointerDown?: (event: ThreeEvent<PointerEvent>) => void;
}) {
  return (
    <instancedMesh ref={ref} frustumCulled={false} args={[geometry, undefined, count]} {...props}>
      {children}
    </instancedMesh>
  );
}

/** Material dos bonecos: cor por vértice × cor da instância + o mesmo realce (um programa de shader para todos). */
function Lit({ roughness, metalness, side }: { roughness: number; metalness?: number; side?: Side }) {
  return <meshStandardMaterial vertexColors roughness={roughness} metalness={metalness} side={side} onBeforeCompile={characterShader} />;
}

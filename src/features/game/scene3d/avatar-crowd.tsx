'use client';

import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type Ref, type RefObject } from 'react';
import { Color, DoubleSide, Euler, Matrix4, Object3D, Quaternion, Vector3, type BufferGeometry, type InstancedMesh, type Side } from 'three';
import { FACE_EXTRAS, MOUTH_STYLES, type BrowStyle, type HairStyle, type MouthStyle } from './avatar-look';
import { FACE, HAIR_GEOMETRIES, HEAD_Y, characterShader, createAvatarGeometries, disposeAvatarGeometries, type V3 } from './avatar-geometry';
import { attachKitAttributes, createGlyphAtlas, jerseyShader, markKitDirty, writeKit } from './jersey-shader';
import { PHASE_MS, WAVE_MS, pose, type AvatarState } from './pose';
import { useStageActivity } from './stage-activity';

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
const SHOULDER: V3 = [0.24, 0.665, 0];
const ELBOW_Y = -0.09;
const HIP: V3 = [0.105, 0.3, 0];
/** Comemoração (vitória/dança) em FPS cheio só no começo; depois segue no ocioso, atrás do diálogo de resultado. */
const CELEBRATION_ACTIVE_MS = 8000;
/** Piscar: a cada ~4 s, 120 ms de olho fechado; fase diferente por boneco. */
const BLINK_PERIOD_S = 4.2;
const BLINK_S = 0.12;

/** Expressão do momento por cima da personalidade: comemorando, sonolento (fantasma), espantado ("por 1"). */
type Mood = 'base' | 'happy' | 'sleepy' | 'wow';
/** Sobrancelha: `lift` sobe, `tilt` > 0 sobe a ponta de dentro (simpatia/tristeza), < 0 desce (bravo). */
const BROW: Record<BrowStyle, { lift: number; tilt: number; scale?: V3 }> = {
  normal: { lift: 0, tilt: 0.06 },
  thick: { lift: 0, tilt: 0.04, scale: [1.1, 1.8, 1.3] },
  uni: { lift: 0, tilt: 0, scale: [2.3, 1.6, 1.2] },
  angry: { lift: -0.01, tilt: -0.38, scale: [1, 1.3, 1] },
  worried: { lift: 0.012, tilt: 0.38 },
  raised: { lift: 0, tilt: 0.1 },
};
/** Boca "fechada" demais para comemorar: abre num sorrisão. As engraçadas (dentuço, banguela...) ficam. */
const CLOSED: readonly MouthStyle[] = ['smile', 'smirk', 'wavy', 'o'];

const colors = new Map<string, Color>();
const cached = (hex: string) => {
  let color = colors.get(hex);
  if (!color) colors.set(hex, (color = new Color(hex)));
  return color;
};

/** Nomes das peças: uma InstancedMesh por nome para a sala toda (as em par recebem 2 instâncias por boneco). */
type Paired = 'legs' | 'shorts' | 'socks' | 'boots' | 'arms' | 'hands' | 'sclera' | 'pupils' | 'lids' | 'halfLids' | 'brows' | 'cheeks';
type Single = 'torso' | 'hips' | 'collar' | 'head' | 'crown' | 'shadow';
type PartName = Paired | Single | `mouth:${MouthStyle}` | `hair:${string}` | `extra:${string}`;

/**
 * Jogadores de futebol (rosto, camisa, número e nome escolhidos ou derivados do id): 1 InstancedMesh por peça para
 * a plateia inteira. Cada peça só desenha as instâncias em uso — bocas, cabelos e extras que ninguém está usando nem
 * vão para a GPU. A camisa é uma peça só com shader próprio (padrão/número/nome por instância).
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
  // Map estável (não ref): as peças se registram pelo ref callback e o quadro lê daqui.
  const [parts] = useState(() => new Map<PartName, InstancedMesh>());
  const ids = useRef<string[]>([]);
  const activity = useStageActivity();
  const geo = useMemo(() => createAvatarGeometries(), []);
  const kit = useMemo(() => attachKitAttributes(geo.torso, MAX_AVATARS), [geo]);
  const atlas = useMemo(() => createGlyphAtlas(), []);
  const kitShader = useMemo(() => jerseyShader(atlas), [atlas]);
  useEffect(
    () => () => {
      disposeAvatarGeometries(geo);
      atlas?.dispose();
    },
    [geo, atlas],
  );
  const tmp = useMemo(
    () => ({
      o: new Object3D(),
      upper: new Matrix4(),
      base: new Matrix4(),
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
      kitTint: new Color(),
      used: new Map<InstancedMesh, number>(),
    }),
    [],
  );

  useLayoutEffect(() => {
    // instanceColor só existe depois do primeiro setColorAt; começa tudo escondido.
    for (const mesh of parts.values()) {
      for (let i = 0; i < mesh.count; i++) {
        mesh.setMatrixAt(i, ZERO);
        mesh.setColorAt(i, WHITE);
      }
      mesh.instanceMatrix.needsUpdate = true;
    }
  }, [parts, fakeShadow]);

  useFrame(() => {
    const p = parts;
    const now = performance.now();
    const t = now / 1000;
    const states = [...(statesRef.current?.values() ?? [])].slice(0, MAX_AVATARS);
    ids.current = states.map((s) => s.userId);
    const used = tmp.used;
    used.clear();

    /** Próxima instância livre da peça. Tronco e cabeça recebem 1 por boneco, na ordem: o índice é o do boneco (toque). */
    const put = (name: PartName, matrix: Matrix4, color?: Color) => {
      const mesh = p.get(name);
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
    let moving = false;

    states.forEach((s, index) => {
      const ps = pose(s, now);
      const { face, jersey } = s.look;
      const ghost = ps.ghost;
      const glow = ps.glow * 0.6;
      const phase = s.look.seed * Math.PI * 2;
      const elapsed = now - s.phaseStart;
      const walking = (s.phase === 'entering' && elapsed < PHASE_MS.entering) || (s.phase === 'leaving' && elapsed >= WAVE_MS);
      const celebrating = s.phase === 'winner' || s.phase === 'dance';
      // Andar, pular e comemorar pedem FPS ativo; respirar/piscar/fantasma ficam no ocioso.
      if (walking || (celebrating && elapsed < CELEBRATION_ACTIVE_MS) || (s.phase === 'ready-jump' && elapsed < PHASE_MS['ready-jump'])) moving = true;
      const mood: Mood = celebrating || s.phase === 'ready-jump' ? 'happy' : ghost > 0.5 ? 'sleepy' : s.oneAway ? 'wow' : 'base';

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

      // camisa: matriz na ordem do boneco + cores/padrão/número/nome nos atributos da instância
      const torso = p.get('torso');
      if (torso) {
        torso.setMatrixAt(index, tmp.upper);
        writeKit(kit, index, s.look, tmp.kitTint.copy(GHOST).multiplyScalar(ghost * (1 - glow)).add(tmp.color.copy(GOLD).multiplyScalar(glow)), (1 - ghost) * (1 - glow));
        used.set(torso, index + 1);
      }
      put('collar', tmp.upper, tint(jersey.collar ?? jersey.secondary, ghost));
      put('hips', tmp.base, tint(jersey.shorts, ghost));

      for (const side of SIDES) {
        // pernas balançam opostas aos braços; calção, meião e chuteira já vêm pendurados na perna
        at(tmp.limb, tmp.base, [side * HIP[0], HIP[1], 0], [walking ? side * ps.armSwing * 0.9 : 0, 0, 0]);
        put('legs', tmp.limb, tint(face.skin, ghost));
        put('shorts', tmp.limb, tint(jersey.shorts, ghost));
        put('socks', tmp.limb, tint(jersey.socks, ghost));
        put('boots', tmp.limb, tint(face.boots, ghost));

        // braço gira no ombro (o direito acena; na comemoração os dois sobem); antebraço dobra no cotovelo
        const raised = side > 0 || celebrating ? ps.armRaise : 0;
        const hang = 0.2 + 0.03 * Math.sin(t * 1.1 + phase) + ghost * 0.55;
        at(tmp.limb, tmp.upper, [side * SHOULDER[0], SHOULDER[1], 0], [-side * ps.armSwing * (walking ? 0.9 : 0.5), 0, side * (hang + raised * (2.6 + side * ps.armSwing))]);
        put('arms', tmp.limb, tint(jersey.sleeves ?? jersey.primary, ghost, glow));
        at(tmp.elbow, tmp.limb, [0, ELBOW_Y, 0], [walking ? -0.45 : raised ? -0.2 : -0.15, 0, raised ? -side * 0.3 : 0]);
        put('hands', tmp.elbow, tint(face.skin, ghost));
      }

      // cabeça: inclina e acena junto com o humor; tudo do rosto/cabelo vai com ela
      const nod = ghost > 0 ? 0.2 : walking ? 0.05 * Math.abs(Math.sin(t * 8)) : s.oneAway ? -0.1 : 0;
      const tilt = celebrating ? 0.16 * Math.sin(t * 7) : ghost > 0 ? 0.18 : 0.06 * Math.sin(t * 0.55 + phase * 3);
      at(tmp.head, tmp.upper, [0, HEAD_Y, 0], [nod, ps.headYaw, tilt]);
      put('head', tmp.head, tint(face.skin, ghost));

      if (face.hairStyle !== 'bald') put(`hair:${face.hairStyle}`, tmp.head, tint(face.hair, ghost));
      for (const extra of face.extras) {
        const color = extra === 'beard' || extra === 'mustache' ? face.hair : extra === 'bigNose' ? face.skin : extra === 'headband' ? jersey.secondary : '#ffffff';
        put(`extra:${extra}`, tmp.head, tint(color, ghost));
      }
      if (s.isHost) put('crown', at(tmp.out, tmp.head, [0, crownLift(face.hairStyle), 0], [-0.12, 0, 0], [1.3, 1.3, 1.3]));

      // olhos: estilo da personalidade (zarolho, desconfiado, sonolento, piscadinha) + piscar e humor
      const blink = (t + s.look.seed * 11) % BLINK_PERIOD_S < BLINK_S;
      const eyes = face.eyes;
      const eyeScale = mood === 'wow' ? 1.2 : eyes === 'big' ? 1.25 : eyes === 'tiny' ? 0.8 : 1;
      const pupilScale = eyes === 'tiny' ? 0.65 : eyes === 'big' ? 1.1 : 1;
      // desconfiado: olha de um lado para o outro devagar; os outros dão uma olhadinha discreta
      const glance = eyes === 'side' ? 0.024 * Math.sign(Math.sin(t * 0.6 + phase)) : 0.006 * Math.sin(t * 0.5 + phase);
      SIDES.forEach((side, k) => {
        tmp.face.multiplyMatrices(tmp.head, FACE.eye[k]);
        const winking = eyes === 'wink' && side > 0;
        if (mood === 'happy' || mood === 'sleepy' || blink || winking) {
          put('lids', at(tmp.out, tmp.face, NONE, [0, 0, mood === 'happy' || winking ? 0 : Math.PI]));
        } else {
          put('sclera', at(tmp.out, tmp.face, NONE, NONE, [eyeScale, eyeScale, 1]));
          const cross = eyes === 'cross' ? -side * 0.022 : 0;
          const droop = eyes === 'sleepy' ? -0.012 : 0;
          put('pupils', at(tmp.out, tmp.face, [cross + glance, droop, 0], NONE, [pupilScale * eyeScale, pupilScale * eyeScale, 1]));
          if (eyes === 'sleepy') put('halfLids', at(tmp.out, tmp.face, NONE, NONE, [eyeScale, eyeScale, 1]), tint(face.skin, ghost));
        }
      });

      // sobrancelhas: estilo + humor (espanto sobe; monocelha é uma peça só no meio)
      const brow = BROW[face.brows];
      const browLift = brow.lift + (mood === 'wow' ? 0.03 : mood === 'happy' ? 0.015 : 0);
      const browColor = tint(face.hair === '#f4c542' ? '#a16207' : face.hair, ghost);
      if (face.brows === 'uni') {
        tmp.face.multiplyMatrices(tmp.head, FACE.unibrow);
        put('brows', at(tmp.out, tmp.face, [0, browLift, 0], [0, 0, 0.04 * Math.sin(t * 2 + phase)], brow.scale), browColor);
      } else {
        SIDES.forEach((side, k) => {
          tmp.face.multiplyMatrices(tmp.head, FACE.brow[k]);
          const lift = browLift + (face.brows === 'raised' && side > 0 ? 0.035 : 0);
          put('brows', at(tmp.out, tmp.face, [0, lift, 0], [0, 0, -side * (brow.tilt + (mood === 'sleepy' ? 0.3 : 0))], brow.scale), browColor);
        });
      }
      SIDES.forEach((_, k) => put('cheeks', tmp.face.multiplyMatrices(tmp.head, FACE.cheek[k])));

      // boca: a da personalidade; comemorando abre, espantado faz "O", sonolento encolhe
      tmp.face.multiplyMatrices(tmp.head, FACE.mouth);
      const mouth: MouthStyle = mood === 'wow' ? 'o' : mood === 'happy' && CLOSED.includes(face.mouth) ? 'grin' : face.mouth;
      if (mood === 'wow') put('mouth:o', at(tmp.out, tmp.face, NONE, NONE, [1, 1 + 0.1 * Math.sin(t * 7), 1]));
      else if (mood === 'sleepy') put(`mouth:${mouth}`, at(tmp.out, tmp.face, NONE, NONE, [0.75, 0.65, 1]));
      else if (mood === 'happy') put(`mouth:${mouth}`, at(tmp.out, tmp.face, NONE, NONE, [1.15, 1.15, 1]));
      else put(`mouth:${mouth}`, tmp.face);

      if (fakeShadow) {
        tmp.o.position.set(ps.position[0], ps.position[1] + 0.02, ps.position[2]);
        tmp.o.rotation.set(-Math.PI / 2, 0, 0);
        tmp.o.scale.setScalar(scale);
        tmp.o.updateMatrix();
        put('shadow', tmp.o.matrix);
      }
    });

    if (moving) activity.keepActive(150);
    markKitDirty(kit);

    for (const mesh of p.values()) {
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

  /** Registra a peça no mapa (ref callback); some do mapa ao desmontar. */
  const bind = (name: PartName) => (mesh: InstancedMesh | null) => {
    if (mesh) parts.set(name, mesh);
    else parts.delete(name);
  };
  const pair = MAX_AVATARS * 2;

  return (
    <group>
      {/* camisa: shader próprio (padrão, escudo, número e nome por instância) */}
      <Part ref={bind('torso')} geometry={geo.torso} count={MAX_AVATARS} castShadow={castShadow} onPointerDown={tap}>
        <meshStandardMaterial vertexColors flatShading roughness={0.7} onBeforeCompile={kitShader} />
      </Part>
      {/* gola, calção, pernas, meião, chuteiras, mangas e mãos */}
      <Part ref={bind('collar')} geometry={geo.collar} count={MAX_AVATARS}>
        <Lit roughness={0.6} />
      </Part>
      <Part ref={bind('hips')} geometry={geo.hips} count={MAX_AVATARS}>
        <Lit roughness={0.8} />
      </Part>
      <Part ref={bind('legs')} geometry={geo.legs} count={pair} castShadow={castShadow}>
        <Lit roughness={0.8} />
      </Part>
      <Part ref={bind('shorts')} geometry={geo.shorts} count={pair}>
        <Lit roughness={0.8} />
      </Part>
      <Part ref={bind('socks')} geometry={geo.socks} count={pair}>
        <Lit roughness={0.8} />
      </Part>
      <Part ref={bind('boots')} geometry={geo.boots} count={pair}>
        <Lit roughness={0.4} />
      </Part>
      <Part ref={bind('arms')} geometry={geo.arms} count={pair} castShadow={castShadow}>
        <Lit roughness={0.7} />
      </Part>
      <Part ref={bind('hands')} geometry={geo.hands} count={pair}>
        <Lit roughness={0.55} />
      </Part>

      {/* cabeça (orelhas e nariz inclusos) e rosto */}
      <Part ref={bind('head')} geometry={geo.head} count={MAX_AVATARS} castShadow={castShadow} onPointerDown={tap}>
        <Lit roughness={0.55} />
      </Part>
      <Part ref={bind('sclera')} geometry={geo.sclera} count={pair}>
        <Lit roughness={0.2} />
      </Part>
      <Part ref={bind('pupils')} geometry={geo.pupils} count={pair}>
        <meshBasicMaterial vertexColors />
      </Part>
      <Part ref={bind('lids')} geometry={geo.lids} count={pair}>
        <meshBasicMaterial vertexColors />
      </Part>
      <Part ref={bind('halfLids')} geometry={geo.halfLids} count={pair}>
        <Lit roughness={0.55} />
      </Part>
      <Part ref={bind('brows')} geometry={geo.brows} count={pair}>
        <Lit roughness={0.7} />
      </Part>
      <Part ref={bind('cheeks')} geometry={geo.cheeks} count={pair}>
        <meshBasicMaterial color="#fb7185" transparent opacity={0.4} depthWrite={false} />
      </Part>
      {MOUTH_STYLES.map((style) => (
        <Part key={style} ref={bind(`mouth:${style}`)} geometry={geo.mouths[style]} count={MAX_AVATARS}>
          <meshBasicMaterial vertexColors side={DoubleSide} />
        </Part>
      ))}

      {/* cabelos e extras: uma peça por estilo; cada boneco usa só os seus */}
      {HAIR_GEOMETRIES.map((style) => (
        <Part key={style} ref={bind(`hair:${style}`)} geometry={geo.hair[style]} count={MAX_AVATARS}>
          <Lit roughness={0.6} side={DoubleSide} />
        </Part>
      ))}
      {FACE_EXTRAS.map((extra) => (
        <Part key={extra} ref={bind(`extra:${extra}`)} geometry={geo.extras[extra]} count={MAX_AVATARS}>
          <Lit roughness={extra === 'glasses' ? 0.25 : 0.6} side={DoubleSide} />
        </Part>
      ))}
      <Part ref={bind('crown')} geometry={geo.crown} count={MAX_AVATARS}>
        <Lit roughness={0.25} metalness={0.8} side={DoubleSide} />
      </Part>
      {fakeShadow && (
        <Part ref={bind('shadow')} geometry={geo.shadow} count={MAX_AVATARS}>
          <meshBasicMaterial color="#000000" transparent opacity={0.28} depthWrite={false} />
        </Part>
      )}
    </group>
  );
}

/** Altura da coroa do host acima do centro da cabeça (cabelo alto empurra para cima). */
const crownLift = (hair: HairStyle) => (hair === 'afro' ? 0.6 : hair === 'mohawk' || hair === 'spiky' || hair === 'quiff' ? 0.52 : 0.4);

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

/** Material dos bonecos: cor por vértice × cor da instância, facetado, + o mesmo realce (um programa de shader por variante). */
function Lit({ roughness, metalness, side }: { roughness: number; metalness?: number; side?: Side }) {
  return <meshStandardMaterial vertexColors flatShading roughness={roughness} metalness={metalness} side={side} onBeforeCompile={characterShader} />;
}

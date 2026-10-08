import {
  BufferAttribute,
  CapsuleGeometry,
  CircleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Euler,
  LatheGeometry,
  Matrix4,
  PlaneGeometry,
  Quaternion,
  SphereGeometry,
  TorusGeometry,
  Vector2,
  Vector3,
  type BufferGeometry,
  type EulerOrder,
  type WebGLProgramParametersWithUniforms,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { HairStyle, Hat } from './avatar-look';

export type V3 = [number, number, number];
export type HatType = Exclude<Hat, 'none'>;
export const HAT_TYPES: HatType[] = ['tophat', 'cap', 'beanie', 'party'];

/** Proporção "chibi": cabeça grande em cima de um corpo pequeno. */
export const HEAD_Y = 1.06;
export const HEAD_R = 0.34;
/** Cabeça um pouco mais larga que alta e queixo afinando: menos "bola", mais rosto. */
const HEAD_SX = 1.05;
const HEAD_SY = 0.94;
/** Offsets entre camadas de um mesmo decalque (olho, boca): folga para o depth buffer a ~20 m da câmera. */
const LAYER = 0.003;

const ORIGIN: V3 = [0, 0, 0];
const ONE: V3 = [1, 1, 1];
const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** g = T(pos) × R(rot) × S(scale) × g */
function xf(g: BufferGeometry, pos: V3 = ORIGIN, rot: V3 = ORIGIN, scale: V3 = ONE, order: EulerOrder = 'XYZ'): BufferGeometry {
  return g.applyMatrix4(new Matrix4().compose(new Vector3(...pos), new Quaternion().setFromEuler(new Euler(...rot, order)), new Vector3(...scale)));
}

/**
 * Cor por vértice (multiplicada pela cor da instância): é o que dá duas cores a uma peça só — aba escura do chapéu,
 * sola branca do tênis, sombra no queixo — sem material nem draw call a mais.
 */
function paint(g: BufferGeometry, hex = '#ffffff', shade?: (p: Vector3) => number): BufferGeometry {
  const base = new Color(hex);
  const position = g.getAttribute('position');
  const colors = new Float32Array(position.count * 3);
  const p = new Vector3();
  for (let i = 0; i < position.count; i++) {
    const k = shade ? shade(p.fromBufferAttribute(position, i)) : 1;
    colors[i * 3] = base.r * k;
    colors[i * 3 + 1] = base.g * k;
    colors[i * 3 + 2] = base.b * k;
  }
  g.setAttribute('color', new BufferAttribute(colors, 3));
  return g;
}

function merge(parts: BufferGeometry[]): BufferGeometry {
  const merged = mergeGeometries(parts);
  for (const part of parts) part.dispose();
  if (!merged) throw new Error('avatar: peças com atributos incompatíveis');
  return merged;
}

// ---------------------------------------------------------------- cabeça e rosto (espaço da cabeça: centro na origem, rosto em +z)

const jaw = (y: number) => Math.max(0, -y / HEAD_R) ** 2;

function shapeHead(p: Vector3): Vector3 {
  const j = jaw(p.y);
  return p.set(p.x * HEAD_SX * (1 - 0.1 * j), p.y * HEAD_SY, p.z * (1 - 0.03 * j));
}

const direction = (yaw: number, pitch: number) => new Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));

function headPoint(yaw: number, pitch: number, lift = 0): Vector3 {
  const d = direction(yaw, pitch);
  return shapeHead(d.clone().multiplyScalar(HEAD_R)).addScaledVector(d, lift);
}

/** Origem na superfície da cabeça, +z apontando para fora: olhos, boca e franja acompanham a curvatura. */
function surface(yaw: number, pitch: number, lift = 0): Matrix4 {
  return new Matrix4().compose(headPoint(yaw, pitch, lift), new Quaternion().setFromEuler(new Euler(-pitch, yaw, 0, 'YXZ')), new Vector3(1, 1, 1));
}

function onHead(g: BufferGeometry, yaw: number, pitch: number, lift = 0, roll = 0): BufferGeometry {
  return g.applyMatrix4(surface(yaw, pitch, lift).multiply(new Matrix4().makeRotationZ(roll)));
}

/** Âncoras do rosto (índice 0 = lado -x, 1 = lado +x). Fixas: o quadro só multiplica pela matriz da cabeça. */
export const FACE = {
  eye: [surface(-0.34, -0.03, -0.006), surface(0.34, -0.03, -0.006)],
  brow: [surface(-0.33, 0.29, 0.004), surface(0.33, 0.29, 0.004)],
  cheek: [surface(-0.62, -0.2, -0.012), surface(0.62, -0.2, -0.012)],
  mouth: surface(0, -0.32, 0.004),
} as const;

function headGeometry(): BufferGeometry {
  const head = new SphereGeometry(HEAD_R, 32, 24);
  const position = head.getAttribute('position');
  const normal = head.getAttribute('normal');
  const p = new Vector3();
  const n = new Vector3();
  for (let i = 0; i < position.count; i++) {
    p.fromBufferAttribute(position, i);
    const j = jaw(p.y);
    // normal da deformação ≈ normal original dividida pela escala de cada eixo
    n.fromBufferAttribute(normal, i);
    n.set(n.x / (HEAD_SX * (1 - 0.1 * j)), n.y / HEAD_SY, n.z / (1 - 0.03 * j)).normalize();
    shapeHead(p);
    position.setXYZ(i, p.x, p.y, p.z);
    normal.setXYZ(i, n.x, n.y, n.z);
  }
  // queixo um pouco mais escuro: "oclusão" barata que separa cabeça e pescoço
  paint(head, '#ffffff', (v) => 0.84 + 0.16 * smoothstep(-0.3, -0.08, v.y));

  const ears = ([-1, 1] as const).flatMap((side) => {
    const yaw = side * 1.52;
    return [
      onHead(paint(xf(new SphereGeometry(0.08, 12, 10), ORIGIN, ORIGIN, [0.62, 1, 0.5])), yaw, -0.06, -0.012),
      onHead(paint(xf(new SphereGeometry(0.05, 10, 8), [0, 0, 0.022], ORIGIN, [0.55, 0.85, 0.3]), '#d9a39b'), yaw, -0.06, -0.012),
    ];
  });
  const nose = onHead(paint(xf(new SphereGeometry(0.036, 12, 8), ORIGIN, ORIGIN, [1.3, 0.95, 0.85]), '#ffe1d6'), 0, -0.14, -0.012);
  return merge([head, ...ears, nose]);
}

/** Olho "anime": esclera, íris com degradê, pupila e dois brilhos — uma peça só, que pisca achatando em y. */
function eyeGeometry(): BufferGeometry {
  return merge([
    paint(xf(new SphereGeometry(0.07, 16, 12), ORIGIN, ORIGIN, [0.82, 1.08, 0.32])),
    paint(xf(new SphereGeometry(0.056, 16, 12), [0, -0.006, 0.01], ORIGIN, [0.82, 1, 0.3]), '#2e2160', (p) => 0.8 + 0.9 * smoothstep(0.03, -0.055, p.y)),
    paint(xf(new SphereGeometry(0.03, 12, 10), [0, -0.004, 0.01 + LAYER * 4], ORIGIN, [0.8, 1, 0.3]), '#0b0820'),
    paint(xf(new SphereGeometry(0.019, 10, 8), [0.02, 0.026, 0.01 + LAYER * 7], ORIGIN, [1, 1, 0.4]), '#ffffff', () => 1.5),
    paint(xf(new SphereGeometry(0.009, 8, 6), [-0.018, -0.026, 0.01 + LAYER * 7], ORIGIN, [1, 1, 0.4]), '#ffffff', () => 1.5),
  ]);
}

/** Arco ∩ centrado no topo (olho fechado/feliz e sobrancelha). */
function arcGeometry(radius: number, tube: number, arc: number): BufferGeometry {
  return xf(new TorusGeometry(radius, tube, 6, 18, arc), [0, -radius, 0], [0, 0, Math.PI / 2 - arc / 2]);
}

function mouthGeometries() {
  const lip = '#5b1324';
  const tongue = '#f2727f';
  return {
    // sorriso fechado ‿
    smile: paint(xf(new TorusGeometry(0.05, 0.012, 6, 18, 2.1), [0, 0.04, 0], [0, 0, -Math.PI / 2 - 1.05]), '#7f1d1d'),
    // boca aberta em "D" com dentes e língua
    open: merge([
      paint(xf(new CircleGeometry(0.068, 20, Math.PI, Math.PI), ORIGIN, ORIGIN, [1, 0.85, 1]), lip),
      paint(xf(new PlaneGeometry(0.1, 0.018), [0, -0.011, LAYER])),
      paint(xf(new CircleGeometry(0.034, 16), [0, -0.036, LAYER], ORIGIN, [1, 0.55, 1]), tongue),
    ]),
    // "uau": boca em O
    wow: merge([
      paint(xf(new CircleGeometry(0.042, 20), ORIGIN, ORIGIN, [0.85, 1.1, 1]), lip),
      paint(xf(new CircleGeometry(0.024, 14), [0, -0.024, LAYER], ORIGIN, [1, 0.55, 1]), tongue),
    ]),
  };
}

// ---------------------------------------------------------------- cabelo (espaço da cabeça)

/** Mais escuro embaixo, mais claro no topo: volume sem textura. */
const hairShade = (p: Vector3) => 0.72 + 0.33 * smoothstep(-0.35, 0.3, p.y);

/** Calota cobrindo topo e nuca, inclinada para trás deixando a testa livre. */
function hairCap(tilt: number): BufferGeometry {
  const cap = xf(new SphereGeometry(HEAD_R + 0.032, 32, 14, 0, Math.PI * 2, 0, Math.PI * 0.56), [0, 0.035, -0.03], [tilt, 0, 0]);
  return xf(cap, ORIGIN, ORIGIN, [HEAD_SX, HEAD_SY, 1]);
}

/** Mecha: elipsoide meio afundado na cabeça; `roll` dá a direção do penteado. */
function lock(yaw: number, pitch: number, roll: number, size = 0.085, stretch: V3 = [1, 0.55, 0.45]): BufferGeometry {
  return onHead(xf(new SphereGeometry(size, 12, 8), ORIGIN, ORIGIN, stretch), yaw, pitch, 0.012, roll);
}

const sideSweptFringe = () => [
  lock(-0.58, 0.5, 0.6, 0.11, [1, 0.6, 0.45]),
  lock(-0.12, 0.58, 0.45, 0.12, [1.1, 0.6, 0.45]),
  lock(0.4, 0.52, 0.3, 0.11, [1, 0.6, 0.45]),
];
const centerPartFringe = (size = 0.085) => [lock(-0.42, 0.48, 0.45, size), lock(-0.14, 0.53, 0.25, size), lock(0.14, 0.53, -0.25, size), lock(0.42, 0.48, -0.45, size)];

/** Espeto: cone com a base na superfície, apontando para fora e um pouco para cima. */
function spike(yaw: number, pitch: number, length: number): BufferGeometry {
  const up = direction(yaw, pitch).add(new Vector3(0, 0.35, 0)).normalize();
  const cone = new ConeGeometry(0.08, length, 10).translate(0, length / 2, 0);
  return cone.applyMatrix4(new Matrix4().compose(headPoint(yaw, pitch, -0.02), new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), up), new Vector3(1, 1, 1)));
}

/** Coque com elástico (faixa escura). */
function bun(): BufferGeometry[] {
  const axis = direction(Math.PI, 1.1);
  const tie = new TorusGeometry(0.085, 0.026, 8, 18).applyMatrix4(
    new Matrix4().compose(headPoint(Math.PI, 1.1, 0.02), new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), axis), new Vector3(1, 1, 1)),
  );
  return [new SphereGeometry(0.15, 16, 12).translate(...headPoint(Math.PI, 1.1, 0.11).toArray()), paint(tie, '#ffffff', () => 0.5)];
}

/** Cortina de cabelo atrás e dos lados, aberta na frente, enrolando para dentro na ponta. */
function curtain(): BufferGeometry {
  const R = HEAD_R;
  const profile = [
    [R - 0.04, -0.48],
    [R + 0.03, -0.43],
    [R + 0.05, -0.28],
    [R + 0.045, -0.08],
    [R + 0.035, 0.06],
    [R + 0.028, 0.14],
  ].map(([r, y]) => new Vector2(r, y));
  const opening = 0.95;
  return xf(new LatheGeometry(profile, 24, opening, Math.PI * 2 - opening * 2), [0, 0, -0.02], ORIGIN, [HEAD_SX, 1, 1]);
}

/** Black power: núcleo + tufos redondos (nada de facetas), deixando o rosto livre. */
function afro(): BufferGeometry[] {
  const center = new Vector3(0, 0.14, -0.17);
  const radius = HEAD_R + 0.08;
  const stretch = new Vector3(1.05, 0.95, 0.9);
  const parts: BufferGeometry[] = [xf(new SphereGeometry(radius, 20, 14), center.toArray(), ORIGIN, stretch.toArray())];
  const rings: [pitch: number, count: number][] = [
    [-0.1, 8],
    [0.35, 8],
    [0.8, 6],
    [1.25, 3],
  ];
  for (const [pitch, count] of rings) {
    for (let k = 0; k < count; k++) {
      const d = direction((k / count) * Math.PI * 2 + pitch, pitch);
      if (d.z > 0.3 && pitch < 0.8) continue; // frente baixa = rosto
      const at = d.multiply(stretch).multiplyScalar(radius * 0.82).add(center);
      parts.push(new SphereGeometry(0.15, 12, 9).translate(at.x, at.y, at.z));
    }
  }
  return parts;
}

function hairGeometry(style: HairStyle): BufferGeometry {
  const sideburns = () => [lock(-1.12, 0, 0, 0.07, [0.5, 1.1, 0.5]), lock(1.12, 0, 0, 0.07, [0.5, 1.1, 0.5])];
  const parts: Record<HairStyle, () => BufferGeometry[]> = {
    short: () => [hairCap(-0.38), ...sideSweptFringe(), ...sideburns()],
    spiky: () => [
      hairCap(-0.3),
      spike(0, 1.45, 0.26),
      spike(0, 0.95, 0.22),
      spike(-0.55, 0.85, 0.2),
      spike(0.55, 0.85, 0.2),
      spike(-1.3, 0.75, 0.2),
      spike(1.3, 0.75, 0.2),
      spike(-2.2, 0.85, 0.22),
      spike(2.2, 0.85, 0.22),
      spike(Math.PI, 0.9, 0.24),
    ],
    bun: () => [hairCap(-0.4), ...centerPartFringe(), ...bun()],
    long: () => [hairCap(-0.36), ...centerPartFringe(0.09), curtain(), lock(-0.9, -0.15, 0, 0.09, [0.5, 1.8, 0.5]), lock(0.9, -0.15, 0, 0.09, [0.5, 1.8, 0.5])],
    afro: afro,
  };
  // o elástico do coque já vem pintado; o resto ganha o degradê de volume
  return merge(parts[style]().map((g) => (g.getAttribute('color') ? g : paint(g, '#ffffff', hairShade))));
}

// ---------------------------------------------------------------- chapéus e coroa (espaço da cabeça)

function hatGeometry(type: HatType): BufferGeometry {
  const R = HEAD_R;
  const build: Record<HatType, () => { parts: BufferGeometry[]; tilt: V3 }> = {
    tophat: () => ({
      tilt: [-0.08, 0, 0],
      parts: [
        paint(xf(new CylinderGeometry(0.31, 0.31, 0.025, 28), [0, 0.385, 0])),
        paint(xf(new CylinderGeometry(0.19, 0.2, 0.32, 24), [0, 0.545, 0])),
        paint(xf(new CylinderGeometry(0.205, 0.205, 0.065, 24), [0, 0.43, 0]), '#ffffff', () => 0.45),
      ],
    }),
    cap: () => ({
      tilt: [-0.12, 0, 0],
      parts: [
        paint(xf(new SphereGeometry(R + 0.05, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2), [0, 0.06, 0], ORIGIN, [1.05, 0.82, 1.02])),
        paint(xf(new CylinderGeometry(0.24, 0.24, 0.022, 20, 1, false, -Math.PI / 2, Math.PI), [0, 0.075, 0.28], [0.12, 0, 0], [1, 1, 0.85]), '#ffffff', () => 0.8),
        paint(xf(new SphereGeometry(0.03, 8, 6), [0, 0.38, 0]), '#ffffff', () => 0.8),
      ],
    }),
    beanie: () => ({
      tilt: [-0.15, 0, 0],
      parts: [
        paint(xf(new SphereGeometry(R + 0.06, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), [0, 0.05, 0], ORIGIN, [1.05, 0.95, 1.02])),
        paint(xf(new CylinderGeometry(R + 0.075, R + 0.08, 0.09, 24, 1, true), [0, 0.07, 0], ORIGIN, [1.05, 1, 1.02]), '#ffffff', () => 0.8),
        paint(xf(new SphereGeometry(0.075, 12, 10), [0, 0.47, 0]), '#ffffff', () => 1.1),
      ],
    }),
    party: () => {
      // cone listrado: 4 troncos alternando tom + pompom na ponta
      const stripes = [0, 1, 2, 3].map((k) => {
        const r = (step: number) => 0.15 * (1 - step / 4);
        return paint(xf(new CylinderGeometry(r(k + 1), r(k), 0.1, 16), [0, 0.41 + k * 0.1, 0]), '#ffffff', () => (k % 2 ? 0.62 : 1));
      });
      return { tilt: [-0.12, 0, 0.12], parts: [...stripes, paint(xf(new SphereGeometry(0.05, 10, 8), [0, 0.77, 0]), '#ffffff', () => 1.15)] };
    },
  };
  const { parts, tilt } = build[type]();
  return xf(merge(parts), ORIGIN, tilt);
}

/** Coroa do host: aro, 5 pontas com bolinhas e pedras coloridas (cores no vértice; instância fica branca). */
function crownGeometry(): BufferGeometry {
  const gold = '#facc15';
  const gems = ['#ef4444', '#3b82f6', '#22c55e', '#3b82f6', '#ef4444'];
  const parts = [paint(new CylinderGeometry(0.19, 0.17, 0.1, 15, 1, true), gold)];
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2;
    const [x, z] = [Math.sin(a), Math.cos(a)];
    parts.push(
      paint(xf(new ConeGeometry(0.045, 0.12, 8), [x * 0.185, 0.11, z * 0.185]), gold),
      paint(xf(new SphereGeometry(0.022, 8, 6), [x * 0.185, 0.175, z * 0.185]), gold),
      paint(xf(new SphereGeometry(0.024, 8, 6), [x * 0.19, 0, z * 0.19], ORIGIN, [1, 1, 0.6]), gems[k]),
    );
  }
  return merge(parts);
}

// ---------------------------------------------------------------- corpo (espaço do boneco: pés no chão)

const lathe = (profile: [number, number][], scaleZ = 0.86) =>
  xf(
    new LatheGeometry(
      profile.map(([r, y]) => new Vector2(r, y)),
      20,
    ),
    ORIGIN,
    ORIGIN,
    [1, 1, scaleZ],
  );

function bodyGeometries() {
  return {
    // camisa: ombros arredondados, cintura, barra levemente aberta e mais escura; bolso no peito
    torso: merge([
      paint(
        lathe([
          [0.2, 0.335],
          [0.232, 0.355],
          [0.228, 0.42],
          [0.214, 0.5],
          [0.222, 0.6],
          [0.212, 0.68],
          [0.178, 0.74],
          [0.12, 0.775],
          [0.001, 0.79],
        ]),
        '#ffffff',
        (p) => (p.y < 0.37 ? 0.8 : 1),
      ),
      paint(xf(new PlaneGeometry(0.075, 0.065), [0.092, 0.58, 0.176], [0, 0.5, 0]), '#ffffff', () => 0.75),
    ]),
    // calça (quadril) por baixo da camisa
    hips: paint(
      lathe([
        [0.001, 0.25],
        [0.13, 0.255],
        [0.2, 0.28],
        [0.226, 0.33],
        [0.22, 0.38],
        [0.205, 0.42],
      ]),
    ),
    collar: paint(xf(new TorusGeometry(0.118, 0.03, 8, 22), [0, 0.765, 0], [Math.PI / 2, 0, 0], [1, 0.86, 1])),
    // perna e tênis pendurados no quadril (origem = articulação)
    legs: paint(xf(new CapsuleGeometry(0.088, 0.12, 4, 10), [0, -0.11, 0]), '#ffffff', (p) => 0.86 + 0.14 * smoothstep(-0.2, -0.02, p.y)),
    shoes: merge([
      paint(xf(new SphereGeometry(0.1, 14, 10), [0, -0.245, 0.035], ORIGIN, [0.92, 0.6, 1.3]), '#2b3446'),
      paint(xf(new CylinderGeometry(0.1, 0.1, 0.034, 16), [0, -0.29, 0.035], ORIGIN, [0.95, 1, 1.32]), '#f1f5f9'),
    ]),
    // manga curta pendurada no ombro; antebraço + mão (pele) pendurados no cotovelo
    arms: paint(xf(new CapsuleGeometry(0.074, 0.05, 4, 12), [0, -0.05, 0])),
    hands: merge([paint(xf(new CapsuleGeometry(0.05, 0.07, 4, 10), [0, -0.05, 0])), paint(xf(new SphereGeometry(0.068, 14, 10), [0, -0.145, 0], ORIGIN, [0.95, 1.05, 0.88]))]),
  };
}

export type AvatarGeometries = ReturnType<typeof createAvatarGeometries>;

/** Todas as geometrias da plateia, criadas uma vez por cena e compartilhadas por todas as instâncias. */
export function createAvatarGeometries() {
  return {
    ...bodyGeometries(),
    head: headGeometry(),
    eyes: eyeGeometry(),
    lids: paint(arcGeometry(0.05, 0.011, 2), '#1e1b4b'),
    brows: paint(xf(arcGeometry(0.09, 0.014, 1.15), ORIGIN, ORIGIN, [1, 1, 0.6]), '#ffffff', () => 0.8),
    cheeks: xf(new SphereGeometry(0.055, 12, 8), ORIGIN, ORIGIN, [1, 0.6, 0.25]),
    mouths: mouthGeometries(),
    hair: Object.fromEntries((['short', 'spiky', 'bun', 'long', 'afro'] as const).map((s) => [s, hairGeometry(s)])) as Record<HairStyle, BufferGeometry>,
    hats: Object.fromEntries(HAT_TYPES.map((t) => [t, hatGeometry(t)])) as Record<HatType, BufferGeometry>,
    crown: crownGeometry(),
    shadow: new CircleGeometry(0.35, 16),
  };
}

export function disposeAvatarGeometries(g: AvatarGeometries) {
  const { mouths, hair, hats, ...rest } = g;
  for (const geometry of [...Object.values(rest), ...Object.values(mouths), ...Object.values(hair), ...Object.values(hats)]) geometry.dispose();
}

/**
 * Luz de preenchimento + contorno (rim) só nos bonecos: destacam o volume contra o salão escuro sem mexer na iluminação
 * da cena. Função única (não closure) para todos os materiais compartilharem o mesmo programa compilado.
 */
export function characterShader(shader: WebGLProgramParametersWithUniforms) {
  shader.fragmentShader = shader.fragmentShader.replace(
    '#include <emissivemap_fragment>',
    /* glsl */ `#include <emissivemap_fragment>
    float characterRim = pow(1.0 - saturate(dot(normal, normalize(vViewPosition))), 3.0);
    totalEmissiveRadiance += diffuseColor.rgb * 0.1 + vec3(0.62, 0.52, 1.0) * characterRim * 0.28;`,
  );
}

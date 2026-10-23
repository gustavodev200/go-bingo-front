import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CapsuleGeometry,
  CircleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Euler,
  IcosahedronGeometry,
  LatheGeometry,
  Matrix4,
  PlaneGeometry,
  Quaternion,
  SphereGeometry,
  TorusGeometry,
  Vector2,
  Vector3,
  type EulerOrder,
  type WebGLProgramParametersWithUniforms,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { HAIR_STYLES, type HairStyle, type MouthStyle } from './avatar-look';

export type V3 = [number, number, number];

/**
 * Proporção de mascote: cabeção "cubo arredondado" (superelipsoide) em cima de um corpo curto. Tudo low-poly e com
 * sombreamento facetado (flatShading no material): as facetas fazem o estilo e mantêm a contagem de triângulos baixa.
 */
export const HEAD_Y = 1.06;
/** Meia-largura, meia-altura e meia-profundidade da cabeça. */
const HX = 0.33;
const HY = 0.31;
const HZ = 0.29;
/** Raio "médio" (chapéus, coroa e etiquetas usam como referência). */
export const HEAD_R = 0.32;
/** Expoente da superelipse: 2 = esfera, ∞ = cubo. */
const ROUND = 3.6;
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
 * Cor por vértice (multiplicada pela cor da instância): é o que dá duas cores a uma peça só — sola da chuteira,
 * barra da camisa, sombra no queixo — sem material nem draw call a mais.
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

/** Junta peças com atributos iguais (posição, normal, cor; sem uv) numa geometria só = um draw call. */
function merge(parts: BufferGeometry[]): BufferGeometry {
  const ready = parts.map((part) => {
    const g = part.index ? part.toNonIndexed() : part;
    if (g !== part) part.dispose();
    if (g.getAttribute('uv')) g.deleteAttribute('uv');
    if (!g.getAttribute('color')) paint(g);
    return g;
  });
  const merged = mergeGeometries(ready);
  for (const part of ready) part.dispose();
  if (!merged) throw new Error('avatar: peças com atributos incompatíveis');
  return merged;
}

// ---------------------------------------------------------------- cabeça (espaço da cabeça: centro na origem, rosto em +z)

const jaw = (y: number) => Math.max(0, -y / HY) ** 2;

/** Ponto da superfície da cabeça na direção `d` (unitária), queixo afinando embaixo. */
function headSurface(d: Vector3, lift = 0): Vector3 {
  const t = 1 / ((Math.abs(d.x) / HX) ** ROUND + (Math.abs(d.y) / HY) ** ROUND + (Math.abs(d.z) / HZ) ** ROUND) ** (1 / ROUND);
  const p = d.clone().multiplyScalar(t);
  p.x *= 1 - 0.14 * jaw(p.y);
  return p.addScaledVector(d, lift);
}

/** Normal da superelipse (gradiente) num ponto da superfície. */
function headNormal(p: Vector3): Vector3 {
  const g = (v: number, h: number) => (Math.sign(v) * Math.abs(v / h) ** (ROUND - 1)) / h;
  return new Vector3(g(p.x, HX), g(p.y, HY), g(p.z, HZ)).normalize();
}

const direction = (yaw: number, pitch: number) => new Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));

/** Origem na superfície da cabeça, +z = normal, +y o mais perto possível de "para cima": decalques deitam na face plana. */
function surface(yaw: number, pitch: number, lift = 0): Matrix4 {
  const p = headSurface(direction(yaw, pitch), lift);
  const z = headNormal(headSurface(direction(yaw, pitch)));
  const x = new Vector3(0, 1, 0).cross(z).normalize();
  const y = z.clone().cross(x);
  return new Matrix4().makeBasis(x, y, z).setPosition(p);
}

function onHead(g: BufferGeometry, yaw: number, pitch: number, lift = 0, roll = 0): BufferGeometry {
  return g.applyMatrix4(surface(yaw, pitch, lift).multiply(new Matrix4().makeRotationZ(roll)));
}

/** Âncoras do rosto (índice 0 = lado -x, 1 = lado +x). Fixas: o quadro só multiplica pela matriz da cabeça. */
export const FACE = {
  eye: [surface(-0.36, 0.02, 0.004), surface(0.36, 0.02, 0.004)],
  brow: [surface(-0.34, 0.33, 0.01), surface(0.34, 0.33, 0.01)],
  unibrow: surface(0, 0.33, 0.012),
  cheek: [surface(-0.62, -0.22, -0.004), surface(0.62, -0.22, -0.004)],
  mouth: surface(0, -0.38, 0.006),
} as const;

/** Casca da cabeça: esfera low-poly projetada na superelipse (`grow` > 0 = camada por cima, cabelo/barba/faixa). */
function headShell(widthSegments: number, heightSegments: number, grow = 0, thetaStart = 0, thetaLength = Math.PI, tilt = 0, phiStart = 0, phiLength = Math.PI * 2): BufferGeometry {
  const g = new SphereGeometry(1, widthSegments, heightSegments, phiStart, phiLength, thetaStart, thetaLength);
  if (tilt) g.rotateX(tilt);
  const position = g.getAttribute('position');
  const d = new Vector3();
  for (let i = 0; i < position.count; i++) {
    d.fromBufferAttribute(position, i).normalize();
    const p = headSurface(d, grow);
    position.setXYZ(i, p.x, p.y, p.z);
  }
  g.computeVertexNormals();
  return g;
}

function headGeometry(): BufferGeometry {
  // queixo um pouco mais escuro: "oclusão" barata que separa cabeça e pescoço
  const head = paint(headShell(12, 9), '#ffffff', (v) => 0.84 + 0.16 * smoothstep(-0.28, -0.06, v.y));
  const ears = ([-1, 1] as const).map((side) => paint(xf(new BoxGeometry(0.06, 0.11, 0.08), [side * (HX + 0.012), -0.02, -0.02], [0, 0, side * 0.12]), '#ffffff', () => 0.93));
  const nose = paint(xf(new ConeGeometry(0.035, 0.07, 4), [0, -0.07, HZ + 0.015], [Math.PI / 2, Math.PI / 4, 0]), '#ffffff', () => 0.94);
  return merge([head, ...ears, nose]);
}

// ---------------------------------------------------------------- olhos, sobrancelhas, bochechas (espaço do decalque)

/** Esclera branca achatada; a pupila é outra peça (anda para o lado: zarolho, desconfiado). */
const scleraGeometry = () => paint(xf(new SphereGeometry(0.058, 10, 8), ORIGIN, ORIGIN, [0.85, 1.1, 0.3]));
/** Pupila com brilho. */
const pupilGeometry = () =>
  merge([
    paint(xf(new SphereGeometry(0.03, 8, 6), [0, 0, 0.012], ORIGIN, [0.9, 1.05, 0.35]), '#0b0820'),
    paint(xf(new SphereGeometry(0.009, 6, 4), [0.011, 0.012, 0.022], ORIGIN, [1, 1, 0.4]), '#ffffff', () => 1.4),
  ]);
/** Arco ∩ centrado no topo (olho fechado/feliz). */
function arcGeometry(radius: number, tube: number, arc: number): BufferGeometry {
  return xf(new TorusGeometry(radius, tube, 4, 10, arc), [0, -radius, 0], [0, 0, Math.PI / 2 - arc / 2]);
}
/** Pálpebra caída (sonolento): meia cúpula da cor da pele cobrindo a metade de cima do olho. */
const halfLidGeometry = () => paint(xf(new SphereGeometry(0.066, 10, 4, 0, Math.PI * 2, 0, Math.PI / 2), [0, -0.004, 0.006], ORIGIN, [0.88, 1, 0.42]), '#ffffff', () => 0.9);

// ---------------------------------------------------------------- bocas (espaço da boca)

function mouthGeometries(): Record<MouthStyle, BufferGeometry> {
  const lip = '#5b1324';
  const tongue = '#f2727f';
  const tooth = '#ffffff';
  const smileArc = () => paint(xf(new TorusGeometry(0.055, 0.012, 4, 12, 2.1), [0, 0.045, 0], [0, 0, -Math.PI / 2 - 1.05]), '#7f1d1d');
  const openD = () => paint(xf(new CircleGeometry(0.07, 12, Math.PI, Math.PI), ORIGIN, ORIGIN, [1.05, 0.9, 1]), lip);
  return {
    // boca aberta em "D" com dentes e língua
    grin: merge([openD(), paint(xf(new PlaneGeometry(0.11, 0.018), [0, -0.011, LAYER]), tooth), paint(xf(new CircleGeometry(0.034, 10), [0, -0.04, LAYER], ORIGIN, [1, 0.55, 1]), tongue)]),
    smile: smileArc(),
    // dentuço: sorriso + dois dentões para fora
    buck: merge([
      smileArc(),
      paint(xf(new BoxGeometry(0.03, 0.045, 0.012), [-0.017, -0.022, 0.004]), tooth),
      paint(xf(new BoxGeometry(0.03, 0.045, 0.012), [0.017, -0.022, 0.004]), tooth),
    ]),
    // banguela: boca aberta com um dente só de cada lado
    gap: merge([
      openD(),
      paint(xf(new PlaneGeometry(0.03, 0.022), [-0.036, -0.012, LAYER]), tooth),
      paint(xf(new PlaneGeometry(0.022, 0.022), [0.04, -0.012, LAYER]), tooth),
      paint(xf(new CircleGeometry(0.03, 10), [0, -0.042, LAYER], ORIGIN, [1, 0.55, 1]), tongue),
    ]),
    // língua para fora, de lado
    tongue: merge([smileArc(), paint(xf(new CapsuleGeometry(0.028, 0.04, 2, 6), [0.018, -0.04, 0.012], [0.5, 0, 0.25], [1, 1, 0.5]), tongue)]),
    // "uau": boca em O
    o: merge([paint(xf(new CircleGeometry(0.042, 12), ORIGIN, ORIGIN, [0.85, 1.15, 1]), lip), paint(xf(new CircleGeometry(0.024, 8), [0, -0.024, LAYER], ORIGIN, [1, 0.55, 1]), tongue)]),
    // sorriso de canto
    smirk: paint(xf(new TorusGeometry(0.05, 0.012, 4, 10, 1.5), [0.03, 0.04, 0], [0, 0, -Math.PI / 2 - 0.4]), '#7f1d1d'),
    // boca tremida de nervoso: zigue-zague
    wavy: merge(
      [-1.5, -0.5, 0.5, 1.5].map((k, i) => paint(xf(new BoxGeometry(0.036, 0.012, 0.01), [k * 0.03, 0, 0], [0, 0, i % 2 ? -0.55 : 0.55]), '#7f1d1d')),
    ),
    // aparelho: boca aberta com faixa de metal e bráquetes
    braces: merge([
      openD(),
      paint(xf(new PlaneGeometry(0.11, 0.022), [0, -0.012, LAYER]), tooth),
      paint(xf(new PlaneGeometry(0.11, 0.006), [0, -0.012, LAYER * 2]), '#94a3b8'),
      ...[-0.036, -0.012, 0.012, 0.036].map((x) => paint(xf(new BoxGeometry(0.01, 0.01, 0.004), [x, -0.012, LAYER * 3]), '#cbd5e1')),
    ]),
  };
}

// ---------------------------------------------------------------- cabelo e extras (espaço da cabeça)

/** Mais escuro embaixo, mais claro no topo: volume sem textura. */
const hairShade = (p: Vector3) => 0.72 + 0.33 * smoothstep(-0.3, 0.3, p.y);

/** Mecha facetada (pirâmide de 4 lados) saindo da cabeça, apontando para fora e um pouco para cima. */
function spike(yaw: number, pitch: number, length: number, radius = 0.085, up = 0.35): BufferGeometry {
  const axis = direction(yaw, pitch).add(new Vector3(0, up, 0)).normalize();
  const cone = new ConeGeometry(radius, length, 4).translate(0, length / 2, 0);
  return cone.applyMatrix4(new Matrix4().compose(headSurface(direction(yaw, pitch), -0.02), new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), axis), new Vector3(1, 1, 1)));
}

/** Calota cobrindo topo e nuca, inclinada para trás deixando a testa livre. */
const cap = (tilt = -0.42, grow = 0.03) => headShell(12, 5, grow, 0, Math.PI * 0.52, tilt);

function hairGeometry(style: Exclude<HairStyle, 'bald'>): BufferGeometry {
  const sideburns = () => ([-1, 1] as const).map((s) => xf(new BoxGeometry(0.04, 0.12, 0.08), [s * (HX + 0.01), 0.05, 0.06]));
  const parts: Record<Exclude<HairStyle, 'bald'>, () => BufferGeometry[]> = {
    // topete facetado caindo para o lado (o da imagem de referência)
    short: () => [cap(), spike(-0.3, 0.72, 0.2, 0.1, 1.2), spike(0.05, 0.78, 0.22, 0.11, 1.0), spike(0.38, 0.7, 0.18, 0.09, 1.3), ...sideburns()],
    spiky: () => [cap(-0.32), ...[[0, 1.4], [0, 0.9], [-0.6, 0.8], [0.6, 0.8], [-1.4, 0.7], [1.4, 0.7], [-2.3, 0.8], [2.3, 0.8], [Math.PI, 0.9]].map(([y, p]) => spike(y, p, 0.24, 0.08))],
    // moicano: lados raspados (calota bem rente) e crista no meio
    mohawk: () => [cap(-0.3, 0.016), ...[0.55, 0.85, 1.15, 1.45, 1.8, 2.2].map((p) => spike(0, p, 0.26, 0.07, 0.6))],
    // black power facetado: casca grande + tufos (icosaedros) longe do rosto
    afro: () => {
      const puffs: BufferGeometry[] = [headShell(12, 6, 0.1, 0, Math.PI * 0.6, -0.5)];
      for (const [pitch, count] of [[0.0, 7], [0.5, 7], [1.0, 5]] as const) {
        for (let k = 0; k < count; k++) {
          const yaw = (k / count) * Math.PI * 2 + pitch;
          if (Math.cos(yaw) > 0.45 && pitch < 0.9) continue; // frente baixa = rosto
          puffs.push(new IcosahedronGeometry(0.15, 0).translate(...headSurface(direction(yaw, pitch), 0.06).toArray()));
        }
      }
      return puffs;
    },
    // cortina só atrás e dos lados (phi de π a 2π = metade de trás), descendo até o pescoço
    long: () => [cap(-0.36), headShell(10, 5, 0.045, Math.PI * 0.3, Math.PI * 0.5, 0, Math.PI - 0.5, Math.PI + 1), spike(-0.25, 0.75, 0.16, 0.1, 1.4), spike(0.25, 0.75, 0.16, 0.1, 1.4)],
    bun: () => [cap(-0.4), new IcosahedronGeometry(0.13, 0).translate(...headSurface(direction(Math.PI, 1.0), 0.1).toArray())],
    // topete alto para a frente
    quiff: () => [cap(-0.3), xf(new IcosahedronGeometry(0.15, 0), headSurface(direction(0, 0.8), 0.06).toArray() as V3, ORIGIN, [1.4, 0.8, 1]), spike(-0.2, 0.9, 0.22, 0.09, 0.8), spike(0.2, 0.9, 0.22, 0.09, 0.8), ...sideburns()],
  };
  return merge(parts[style]().map((g) => paint(g, '#ffffff', hairShade)));
}

/** Barba cheia: casca na parte de baixo da cabeça (a boca fica de fora, por cima). */
const beardGeometry = () => merge([paint(headShell(12, 4, 0.025, Math.PI * 0.66, Math.PI * 0.34), '#ffffff', hairShade), paint(xf(new BoxGeometry(0.1, 0.03, 0.03), [0, -0.075, HZ + 0.012]), '#ffffff', hairShade)]);

/** Bigodão (duas metades caindo para fora). */
const mustacheGeometry = () =>
  merge(([-1, 1] as const).map((side) => paint(onHead(xf(new SphereGeometry(0.06, 8, 6), ORIGIN, ORIGIN, [1.4, 0.55, 0.5]), side * 0.16, -0.24, 0.006, -side * 0.35), '#ffffff', hairShade)));

/** Narigão de batata por cima do nariz pequeno. */
const bigNoseGeometry = () => paint(onHead(new IcosahedronGeometry(0.06, 1), 0, -0.1, 0.01), '#ffffff', () => 0.95);

/** Óculos redondos fundo de garrafa (aro + ponte + hastes). */
function glassesGeometry(): BufferGeometry {
  const parts: BufferGeometry[] = [];
  FACE.eye.forEach((m, k) => {
    parts.push(paint(new TorusGeometry(0.072, 0.012, 4, 12).applyMatrix4(m.clone().multiply(new Matrix4().makeTranslation(0, 0, 0.03))), '#111827'));
    const side = k ? 1 : -1;
    parts.push(paint(xf(new BoxGeometry(0.012, 0.012, 0.26), [side * (HX + 0.004), 0.01, 0.15]), '#111827'));
  });
  parts.push(paint(xf(new BoxGeometry(0.06, 0.012, 0.012), [0, 0.02, HZ + 0.04]), '#111827'));
  return merge(parts);
}

/** Sardas: pontinhos nas bochechas. */
const frecklesGeometry = () =>
  merge(
    FACE.cheek.flatMap((m) =>
      [
        [-0.03, 0.012],
        [0.0, -0.01],
        [0.03, 0.014],
        [0.012, 0.03],
      ].map(([x, y]) => paint(new CircleGeometry(0.009, 5).applyMatrix4(m.clone().multiply(new Matrix4().makeTranslation(x, y, 0.02))), '#8b4513')),
    ),
  );

/** Curativo em X na bochecha. */
const bandageGeometry = () =>
  merge(
    [0.7, -0.7].map((roll) => paint(new BoxGeometry(0.11, 0.03, 0.008).applyMatrix4(FACE.cheek[1].clone().multiply(new Matrix4().compose(new Vector3(0, 0.02, 0.02), new Quaternion().setFromEuler(new Euler(0, 0, roll)), new Vector3(1, 1, 1)))), '#fde7c8')),
  );

/** Faixa de testa (cor da camisa na instância): anel justo na cabeça. */
function headbandGeometry(): BufferGeometry {
  const ring = new CylinderGeometry(1, 1, 1, 14, 1, true);
  const position = ring.getAttribute('position');
  const d = new Vector3();
  for (let i = 0; i < position.count; i++) {
    const y = position.getY(i);
    d.set(position.getX(i), 0, position.getZ(i)).normalize();
    d.y = 0.62 + y * 0.18;
    d.normalize();
    const p = headSurface(d, 0.04);
    position.setXYZ(i, p.x, p.y, p.z);
  }
  ring.computeVertexNormals();
  return paint(ring);
}

/** Coroa do host: aro, 5 pontas com bolinhas e pedras coloridas (cores no vértice; instância fica branca). */
function crownGeometry(): BufferGeometry {
  const gold = '#facc15';
  const gems = ['#ef4444', '#3b82f6', '#22c55e', '#3b82f6', '#ef4444'];
  const parts = [paint(new CylinderGeometry(0.19, 0.17, 0.1, 10, 1, true), gold)];
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2;
    const [x, z] = [Math.sin(a), Math.cos(a)];
    parts.push(
      paint(xf(new ConeGeometry(0.045, 0.12, 4), [x * 0.185, 0.11, z * 0.185]), gold),
      paint(xf(new IcosahedronGeometry(0.022, 0), [x * 0.185, 0.175, z * 0.185]), gold),
      paint(xf(new IcosahedronGeometry(0.024, 0), [x * 0.19, 0, z * 0.19], ORIGIN, [1, 1, 0.6]), gems[k]),
    );
  }
  return merge(parts);
}

// ---------------------------------------------------------------- corpo (espaço do boneco: pés no chão)

const lathe = (profile: [number, number][], segments: number, scaleZ = 0.86) =>
  xf(
    new LatheGeometry(
      profile.map(([r, y]) => new Vector2(r, y)),
      segments,
    ),
    ORIGIN,
    ORIGIN,
    [1, 1, scaleZ],
  );

/** Camisa: ombros largos, cintura, barra levemente aberta. Padrão, escudo, número e nome vêm do shader (jersey-shader). */
export const TORSO: [number, number][] = [
  [0.205, 0.335],
  [0.236, 0.36],
  [0.226, 0.45],
  [0.222, 0.6],
  [0.214, 0.69],
  [0.178, 0.75],
  [0.11, 0.78],
  [0.001, 0.79],
];
/** Faixa do tronco onde o shader desenha (em y). */
export const TORSO_Y: [number, number] = [0.335, 0.79];

function bodyGeometries() {
  const boot = () =>
    merge([
      paint(xf(new BoxGeometry(0.15, 0.08, 0.24, 1, 1, 2), [0, -0.245, 0.04]), '#ffffff', (p) => (p.z > 0.1 ? 1.1 : 1)),
      // sola escura com travas
      paint(xf(new BoxGeometry(0.16, 0.025, 0.25), [0, -0.29, 0.04]), '#ffffff', () => 0.3),
      paint(xf(new BoxGeometry(0.11, 0.012, 0.02), [0, -0.265, 0.165]), '#ffffff', () => 1.25),
    ]);
  return {
    // camisa com barra um tom mais escura (o resto da cor vem do shader da camisa)
    torso: merge([paint(lathe(TORSO, 14), '#ffffff', (p) => (p.y < 0.36 ? 0.82 : 1))]),
    // calção: quadril por baixo da camisa
    hips: paint(
      lathe(
        [
          [0.001, 0.25],
          [0.14, 0.255],
          [0.215, 0.28],
          [0.232, 0.33],
          [0.222, 0.38],
          [0.205, 0.42],
        ],
        12,
      ),
    ),
    // gola em V: dois filetes descendo do pescoço + aro
    collar: merge([
      paint(xf(new TorusGeometry(0.115, 0.024, 4, 12), [0, 0.765, 0], [Math.PI / 2, 0, 0], [1, 0.86, 1])),
      paint(xf(new BoxGeometry(0.022, 0.1, 0.02), [-0.035, 0.735, 0.165], [0.25, 0, -0.5])),
      paint(xf(new BoxGeometry(0.022, 0.1, 0.02), [0.035, 0.735, 0.165], [0.25, 0, 0.5])),
    ]),
    // perna (pele) pendurada no quadril (origem = articulação)
    legs: paint(xf(new CapsuleGeometry(0.075, 0.14, 2, 6), [0, -0.11, 0]), '#ffffff', (p) => 0.86 + 0.14 * smoothstep(-0.2, -0.02, p.y)),
    // perna do calção, com barra
    shorts: paint(xf(new CylinderGeometry(0.105, 0.112, 0.11, 8), [0, -0.025, 0]), '#ffffff', (p) => (p.y < -0.07 ? 0.85 : 1)),
    // meião com faixa no punho
    socks: paint(xf(new CylinderGeometry(0.084, 0.082, 0.1, 8, 3), [0, -0.175, 0]), '#ffffff', (p) => (p.y > -0.145 && p.y < -0.13 ? 1.25 : 1)),
    boots: boot(),
    // manga curta pendurada no ombro (barra mais escura); mão (pele) pendurada no cotovelo
    arms: paint(xf(new CapsuleGeometry(0.075, 0.05, 2, 8), [0, -0.05, 0]), '#ffffff', (p) => (p.y < -0.1 ? 0.85 : 1)),
    hands: merge([xf(new CapsuleGeometry(0.048, 0.07, 2, 6), [0, -0.05, 0]), xf(new IcosahedronGeometry(0.068, 1), [0, -0.145, 0], ORIGIN, [0.95, 1.05, 0.88])]),
  };
}

export type AvatarGeometries = ReturnType<typeof createAvatarGeometries>;
export type FaceExtraGeometry = 'beard' | 'mustache' | 'bigNose' | 'glasses' | 'freckles' | 'bandage' | 'headband';
export type HairGeometry = Exclude<HairStyle, 'bald'>;
export const HAIR_GEOMETRIES = HAIR_STYLES.filter((s): s is HairGeometry => s !== 'bald');

/** Todas as geometrias dos bonecos, criadas uma vez por cena e compartilhadas por todas as instâncias. */
export function createAvatarGeometries() {
  return {
    ...bodyGeometries(),
    head: headGeometry(),
    sclera: scleraGeometry(),
    pupils: pupilGeometry(),
    lids: paint(arcGeometry(0.05, 0.012, 2), '#1e1b4b'),
    halfLids: halfLidGeometry(),
    brows: paint(new BoxGeometry(0.12, 0.026, 0.02)),
    cheeks: xf(new CircleGeometry(0.05, 8), ORIGIN, ORIGIN, [1, 0.6, 1]),
    mouths: mouthGeometries(),
    extras: {
      beard: beardGeometry(),
      mustache: mustacheGeometry(),
      bigNose: bigNoseGeometry(),
      glasses: glassesGeometry(),
      freckles: frecklesGeometry(),
      bandage: bandageGeometry(),
      headband: headbandGeometry(),
    } satisfies Record<FaceExtraGeometry, BufferGeometry>,
    hair: Object.fromEntries(HAIR_GEOMETRIES.map((s) => [s, hairGeometry(s)])) as Record<HairGeometry, BufferGeometry>,
    crown: crownGeometry(),
    shadow: new CircleGeometry(0.35, 12),
  };
}

export function disposeAvatarGeometries(g: AvatarGeometries) {
  const { mouths, hair, extras, ...rest } = g;
  for (const geometry of [...Object.values(rest), ...Object.values(mouths), ...Object.values(hair), ...Object.values(extras)]) geometry.dispose();
}

/** Triângulos de uma geometria (orçamento do boneco; ver teste). */
export function trianglesOf(g: BufferGeometry): number {
  return (g.index ? g.index.count : g.getAttribute('position').count) / 3;
}

/**
 * Luz de preenchimento + contorno (rim) só nos bonecos: destacam o volume contra o salão escuro sem mexer na iluminação
 * da cena. Função única (não closure) para todos os materiais compartilharem o mesmo programa compilado.
 */
export function characterShader(shader: WebGLProgramParametersWithUniforms) {
  shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', RIM_GLSL);
}

export const RIM_GLSL = /* glsl */ `#include <emissivemap_fragment>
    float characterRim = pow(1.0 - saturate(dot(normal, normalize(vViewPosition))), 3.0);
    totalEmissiveRadiance += diffuseColor.rgb * 0.1 + vec3(0.62, 0.52, 1.0) * characterRim * 0.28;`;

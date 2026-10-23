import { CanvasTexture, InstancedBufferAttribute, LinearFilter, type BufferGeometry, type Color, type Texture, type WebGLProgramParametersWithUniforms } from 'three';
import { RIM_GLSL } from './avatar-geometry';
import type { AvatarLook } from './avatar-look';
import { BACK_GLYPHS, MAX_BACK_NAME } from './characters';
import { JERSEY_PATTERNS } from './jerseys';

/**
 * Camisa no shader: um InstancedMesh só para o tronco de todos os bonecos, cada instância com as suas cores, padrão,
 * número e nome. Tudo que muda por jogador são 5 atributos vec4 por instância — trocar de camisa é reescrever floats,
 * sem textura nova, sem material novo, sem recompilar.
 *
 * Cores vão empacotadas num float (0xRRGGBB cabe exato nos 24 bits de mantissa) e chegam ao fragment como `flat`.
 * Número e nome usam um atlas único de glifos (A–Z, 0–9) desenhado num canvas.
 */

const ATLAS_COLS = 8;
const ATLAS_ROWS = 5;
const CELL = 64;

/** Código de glifo: índice em BACK_GLYPHS + 1; 0 = vazio (espaço). */
export function glyphCode(char: string): number {
  const i = BACK_GLYPHS.indexOf(char);
  return i < 0 ? 0 : i + 1;
}

/** "#rrggbb" → inteiro 0xRRGGBB (exato em float32). */
export const packHex = (hex: string) => Number.parseInt(hex.slice(1), 16);

/** Nome em 8 floats: 2 glifos por float (a × 64 + b), 16 letras no máximo (usamos 12). */
export function packName(name: string): number[] {
  const codes = Array.from({ length: 16 }, (_, i) => glyphCode(name[i] ?? ' '));
  return Array.from({ length: 8 }, (_, i) => codes[i * 2] * 64 + codes[i * 2 + 1]);
}

/** Atlas de glifos brancos (o shader pinta com a cor da tinta da camisa). null sem canvas 2D (testes/SSR). */
export function createGlyphAtlas(): Texture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = ATLAS_COLS * CELL;
  canvas.height = ATLAS_ROWS * CELL;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `900 ${CELL * 0.86}px system-ui, "Arial Black", sans-serif`;
  [...BACK_GLYPHS].forEach((char, i) => {
    const [col, row] = [i % ATLAS_COLS, Math.floor(i / ATLAS_COLS)];
    ctx.fillText(char, col * CELL + CELL / 2, row * CELL + CELL / 2 + CELL * 0.04, CELL * 0.9);
  });
  const texture = new CanvasTexture(canvas);
  texture.minFilter = LinearFilter;
  texture.generateMipmaps = false;
  return texture;
}

export type KitAttributes = {
  colors: InstancedBufferAttribute;
  more: InstancedBufferAttribute;
  name0: InstancedBufferAttribute;
  name1: InstancedBufferAttribute;
  tint: InstancedBufferAttribute;
};

/**
 * Pendura os atributos por instância na geometria do tronco (que é só desta cena). Idempotente: o StrictMode chama o
 * useMemo duas vezes, e a segunda chamada não pode trocar os atributos que a primeira devolveu.
 */
export function attachKitAttributes(geometry: BufferGeometry, count: number): KitAttributes {
  const existing = geometry.getAttribute('kitColors');
  if (existing instanceof InstancedBufferAttribute) {
    const get = (name: string) => geometry.getAttribute(name) as InstancedBufferAttribute;
    return { colors: existing, more: get('kitMore'), name0: get('kitName0'), name1: get('kitName1'), tint: get('kitTint') };
  }
  const make = () => new InstancedBufferAttribute(new Float32Array(count * 4), 4);
  const attrs = { colors: make(), more: make(), name0: make(), name1: make(), tint: make() };
  geometry.setAttribute('kitColors', attrs.colors);
  geometry.setAttribute('kitMore', attrs.more);
  geometry.setAttribute('kitName0', attrs.name0);
  geometry.setAttribute('kitName1', attrs.name1);
  geometry.setAttribute('kitTint', attrs.tint);
  return attrs;
}

const nameCache = new Map<string, number[]>();

/**
 * Escreve a camisa do boneco na instância `index`. `tint` = cor de mistura (linear) e `keep` = quanto da cor original
 * fica: cor final = original × keep + tint (fantasma lilás / brilho dourado já combinados).
 */
export function writeKit(attrs: KitAttributes, index: number, look: AvatarLook, tint: Color, keep: number) {
  const j = look.jersey;
  attrs.colors.setXYZW(index, packHex(j.primary), packHex(j.secondary), packHex(j.accent), packHex(j.ink ?? '#ffffff'));
  attrs.more.setXYZW(index, j.badge ? packHex(j.badge) : -1, JERSEY_PATTERNS.indexOf(j.pattern), j.stripes ?? 6, look.number);
  let name = nameCache.get(look.backName);
  if (!name) nameCache.set(look.backName, (name = packName(look.backName.slice(0, MAX_BACK_NAME))));
  attrs.name0.setXYZW(index, name[0], name[1], name[2], name[3]);
  attrs.name1.setXYZW(index, name[4], name[5], name[6], name[7]);
  attrs.tint.setXYZW(index, tint.r, tint.g, tint.b, keep);
}

export function markKitDirty(attrs: KitAttributes) {
  for (const a of Object.values(attrs)) a.needsUpdate = true;
}

const VERTEX_PARS = /* glsl */ `#include <common>
attribute vec4 kitColors;
attribute vec4 kitMore;
attribute vec4 kitName0;
attribute vec4 kitName1;
attribute vec4 kitTint;
flat varying vec4 vKitColors;
flat varying vec4 vKitMore;
flat varying vec4 vKitName0;
flat varying vec4 vKitName1;
flat varying vec4 vKitTint;
varying vec3 vKitPos;`;

const VERTEX_MAIN = /* glsl */ `#include <begin_vertex>
vKitColors = kitColors;
vKitMore = kitMore;
vKitName0 = kitName0;
vKitName1 = kitName1;
vKitTint = kitTint;
vKitPos = position;`;

const FRAGMENT_PARS = /* glsl */ `#include <common>
uniform sampler2D kitGlyphs;
flat varying vec4 vKitColors;
flat varying vec4 vKitMore;
flat varying vec4 vKitName0;
flat varying vec4 vKitName1;
flat varying vec4 vKitTint;
varying vec3 vKitPos;

vec3 kitColor(float c) {
  vec3 s = vec3(floor(c / 65536.0), mod(floor(c / 256.0), 256.0), mod(c, 256.0)) / 255.0;
  return mix(s / 12.92, pow((s + 0.055) / 1.055, vec3(2.4)), step(0.04045, s));
}

float kitStar(vec2 p, float r, float rf) {
  const vec2 k1 = vec2(0.809016994375, -0.587785252292);
  const vec2 k2 = vec2(-k1.x, k1.y);
  p.x = abs(p.x);
  p -= 2.0 * max(dot(k1, p), 0.0) * k1;
  p -= 2.0 * max(dot(k2, p), 0.0) * k2;
  p.x = abs(p.x);
  p.y -= r;
  vec2 ba = rf * vec2(-k1.y, k1.x) - vec2(0.0, 1.0);
  float h = clamp(dot(p, ba) / dot(ba, ba), 0.0, r);
  return length(p - ba * h) * sign(p.y * ba.x - p.x * ba.y);
}

/** Glifo (código 1..36) em uv de célula [0,1]²: alfa do atlas. */
float kitGlyph(float code, vec2 uv) {
  if (code < 0.5 || uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return 0.0;
  float i = code - 1.0;
  vec2 cell = vec2(mod(i, ${ATLAS_COLS}.0), floor(i / ${ATLAS_COLS}.0));
  return texture2D(kitGlyphs, vec2((cell.x + uv.x) / ${ATLAS_COLS}.0, 1.0 - (cell.y + 1.0 - uv.y) / ${ATLAS_ROWS}.0)).a;
}

/** (preenchimento, contorno) do glifo: o contorno destaca o número sobre listras/faixas, como nas camisas de verdade. */
vec2 kitInk(float code, vec2 uv) {
  const vec2 o = vec2(0.07, 0.05);
  float fill = kitGlyph(code, uv);
  float edge = max(max(kitGlyph(code, uv + vec2(o.x, 0.0)), kitGlyph(code, uv - vec2(o.x, 0.0))), max(kitGlyph(code, uv + vec2(0.0, o.y)), kitGlyph(code, uv - vec2(0.0, o.y))));
  return vec2(fill, max(edge, fill));
}

float kitNameCode(int i) {
  int f = i / 2;
  float packed = f < 4 ? vKitName0[f] : vKitName1[f - 4];
  return (i - f * 2) == 0 ? floor(packed / 64.0) : mod(packed, 64.0);
}`;

const FRAGMENT_MAIN = /* glsl */ `#include <color_fragment>
{
  vec3 p = vKitPos;
  vec3 primary = kitColor(vKitColors.x);
  vec3 secondary = kitColor(vKitColors.y);
  vec3 accent = kitColor(vKitColors.z);
  vec3 ink = kitColor(vKitColors.w);
  int pattern = int(vKitMore.y + 0.5);
  float n = vKitMore.z;
  float ang = atan(p.x, p.z / 0.86);
  float turn = ang / 6.28318530718;
  float h = (p.y - 0.335) / 0.455;
  bool front = p.z > 0.0;
  vec3 kit = primary;
  if (pattern == 1) kit = mix(primary, secondary, step(0.5, fract(turn * n + 0.25)));
  else if (pattern == 2) kit = mix(primary, secondary, step(0.5, fract(h * n * 0.5)));
  else if (pattern == 3 && front) kit = mix(primary, secondary, step(abs(dot(p.xy - vec2(0.0, 0.555), normalize(vec2(0.39, -0.42)))), 0.055));
  else if (pattern == 4) kit = p.x > 0.0 ? secondary : primary;
  else if (pattern == 5) {
    float s = fract(turn * n + 0.21);
    kit = s < 0.42 ? primary : s < 0.5 ? accent : s < 0.92 ? secondary : accent;
  }
  else if (pattern == 6) kit = p.y > 0.56 && p.y < 0.6 ? secondary : p.y >= 0.6 && p.y < 0.64 ? accent : primary;
  else if (pattern == 7) {
    float v = p.y + abs(p.x) * 0.9;
    kit = front && v > 0.6 && v < 0.67 ? secondary : front && v >= 0.67 && v < 0.69 ? accent : primary;
  }
  else if (pattern == 8 && front) kit = kitStar(p.xy - vec2(0.0, 0.57), 0.085, 0.42) < 0.0 ? secondary : primary;
  else if (pattern == 9 && front) {
    vec2 q = p.xy - vec2(0.0, 0.565);
    float d = abs(q.x) / 0.16 + abs(q.y) / 0.1;
    kit = length(q) < 0.04 ? accent : d < 0.78 ? primary : d < 1.0 ? secondary : primary;
  }
  else if (pattern == 10) kit = mix(primary, secondary, step(0.88, fract(turn * n)));

  // escudo genérico no peito esquerdo do boneco (+x): marcador no lugar do escudo do clube
  if (front && vKitMore.x >= 0.0) {
    vec2 q = p.xy - vec2(0.095, 0.64);
    float shield = q.y > 0.0 ? max(abs(q.x), q.y * 1.15) : length(vec2(q.x, q.y * 0.85));
    if (shield < 0.034) kit = shield < 0.026 ? kitColor(vKitMore.x) : accent;
  }

  // costas: nome em cima, número grande embaixo (lido de trás: esquerda do leitor = +x)
  if (p.z < -0.06) {
    float x = -p.x;
    vec3 outline = dot(ink, vec3(0.2126, 0.7152, 0.0722)) > 0.3 ? vec3(0.01) : vec3(0.9);
    float number = vKitMore.w;
    if (number > 0.5) {
      float tens = floor(number / 10.0);
      float ones = mod(number, 10.0);
      float w = 0.13;
      vec2 uv = vec2(0.0, (p.y - 0.43) / 0.19);
      vec2 g = tens > 0.5
        ? max(kitInk(27.0 + tens, vec2((x + w) / w, uv.y)), kitInk(27.0 + ones, vec2(x / w, uv.y)))
        : kitInk(27.0 + ones, vec2((x + w * 0.5) / w, uv.y));
      kit = mix(mix(kit, outline, g.y), ink, g.x);
    }
    int len = 0;
    for (int i = 0; i < 16; i++) if (kitNameCode(i) > 0.5) len = i + 1;
    if (len > 0) {
      float cw = min(0.04, 0.34 / float(len));
      float left = -cw * float(len) * 0.5;
      float slot = floor((x - left) / cw);
      if (slot >= 0.0 && slot < float(len)) {
        vec2 uv = vec2((x - left - slot * cw) / cw, (p.y - 0.645) / 0.055);
        vec2 g = kitInk(kitNameCode(int(slot)), uv);
        kit = mix(mix(kit, outline, g.y), ink, g.x);
      }
    }
  }
  diffuseColor.rgb *= kit;
  diffuseColor.rgb = diffuseColor.rgb * vKitTint.a + vKitTint.rgb;
}`;

/**
 * onBeforeCompile do material da camisa (um só por cena). `atlas` null = sem número/nome (não há canvas).
 * Inclui o mesmo contorno dos outros materiais dos bonecos.
 */
export function jerseyShader(atlas: Texture | null) {
  return (shader: WebGLProgramParametersWithUniforms) => {
    shader.uniforms.kitGlyphs = { value: atlas };
    shader.vertexShader = shader.vertexShader.replace('#include <common>', VERTEX_PARS).replace('#include <begin_vertex>', VERTEX_MAIN);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', FRAGMENT_PARS)
      .replace('#include <color_fragment>', FRAGMENT_MAIN)
      .replace('#include <emissivemap_fragment>', RIM_GLSL);
  };
}

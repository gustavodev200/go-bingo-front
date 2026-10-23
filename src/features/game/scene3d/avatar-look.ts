import { CHARACTER_FACES, type CharacterFace } from '@/contracts';
import { COMMUNITY_JERSEYS, type Jersey } from './jerseys';

export const HAIR_STYLES = ['short', 'spiky', 'mohawk', 'afro', 'long', 'bun', 'quiff', 'bald'] as const;
export const EYE_STYLES = ['normal', 'big', 'tiny', 'cross', 'side', 'sleepy', 'wink'] as const;
export const BROW_STYLES = ['normal', 'thick', 'uni', 'angry', 'worried', 'raised'] as const;
export const MOUTH_STYLES = ['grin', 'smile', 'buck', 'gap', 'tongue', 'o', 'smirk', 'wavy', 'braces'] as const;
export const FACE_EXTRAS = ['mustache', 'beard', 'glasses', 'bigNose', 'freckles', 'bandage', 'headband'] as const;

export type HairStyle = (typeof HAIR_STYLES)[number];
export type EyeStyle = (typeof EYE_STYLES)[number];
export type BrowStyle = (typeof BROW_STYLES)[number];
export type MouthStyle = (typeof MOUTH_STYLES)[number];
export type FaceExtra = (typeof FACE_EXTRAS)[number];

/** Rosto = personalidade do boneco: pele, cabelo, olhos, sobrancelha, boca, extras e a cor da chuteira. */
export interface Face {
  name: string;
  skin: string;
  hair: string;
  hairStyle: HairStyle;
  eyes: EyeStyle;
  brows: BrowStyle;
  mouth: MouthStyle;
  extras: readonly FaceExtra[];
  boots: string;
}

/**
 * Os rostos do seletor (setas ← →), na ordem. Cada um puxa uma piada diferente — dentuço, banguela, zarolho,
 * monocelha, bigodão... — e juntos cobrem todos os tons de pele, cabelos, olhos, sobrancelhas, bocas e extras.
 * Um id novo no contrato sem entrada aqui não compila.
 */
export const FACES: Record<CharacterFace, Face> = {
  a: { name: 'Craque', skin: '#f2c29b', hair: '#5a3418', hairStyle: 'short', eyes: 'normal', brows: 'normal', mouth: 'grin', extras: [], boots: '#111827' },
  b: { name: 'Dentuço', skin: '#fde0c8', hair: '#e8590c', hairStyle: 'spiky', eyes: 'big', brows: 'raised', mouth: 'buck', extras: ['freckles'], boots: '#22c55e' },
  c: { name: 'Banguela', skin: '#8d5524', hair: '#1f1308', hairStyle: 'bald', eyes: 'tiny', brows: 'thick', mouth: 'gap', extras: ['bigNose'], boots: '#f59e0b' },
  d: { name: 'Zarolho', skin: '#c68642', hair: '#1f1308', hairStyle: 'afro', eyes: 'cross', brows: 'worried', mouth: 'tongue', extras: [], boots: '#ec4899' },
  e: { name: 'Monocelha', skin: '#e0a47a', hair: '#1f1308', hairStyle: 'mohawk', eyes: 'normal', brows: 'uni', mouth: 'smirk', extras: [], boots: '#ef4444' },
  f: { name: 'Bigodão', skin: '#f5c6a0', hair: '#4a2c12', hairStyle: 'quiff', eyes: 'normal', brows: 'thick', mouth: 'smile', extras: ['mustache', 'bigNose'], boots: '#e11d74' },
  g: { name: 'Soneca', skin: '#fde0c8', hair: '#f4c542', hairStyle: 'long', eyes: 'sleepy', brows: 'worried', mouth: 'wavy', extras: [], boots: '#6366f1' },
  h: { name: 'Piscadinha', skin: '#5c3a1e', hair: '#1f1308', hairStyle: 'mohawk', eyes: 'wink', brows: 'raised', mouth: 'tongue', extras: ['bandage'], boots: '#facc15' },
  i: { name: 'Nerdola', skin: '#f5c6a0', hair: '#1f1308', hairStyle: 'bun', eyes: 'big', brows: 'normal', mouth: 'braces', extras: ['glasses'], boots: '#0ea5e9' },
  j: { name: 'Lenhador', skin: '#c68642', hair: '#2b1a0e', hairStyle: 'short', eyes: 'tiny', brows: 'angry', mouth: 'o', extras: ['beard'], boots: '#111827' },
  k: { name: 'Desconfiado', skin: '#e0a47a', hair: '#a0522d', hairStyle: 'spiky', eyes: 'side', brows: 'angry', mouth: 'smirk', extras: ['headband'], boots: '#a855f7' },
  l: { name: 'Chorão', skin: '#8d5524', hair: '#1f1308', hairStyle: 'quiff', eyes: 'big', brows: 'worried', mouth: 'o', extras: ['freckles', 'headband'], boots: '#14b8a6' },
};

export type AvatarLook = {
  face: Face;
  jersey: Jersey;
  /** Número nas costas (1..99); 0 = sem número. */
  number: number;
  /** Nome nas costas, já em maiúsculas e só com letras do atlas; '' = sem nome. */
  backName: string;
  /** Fase do piscar/respirar, em [0, 1). */
  seed: number;
};

/** FNV-1a 32 bits: rápido, estável entre navegadores. */
export function hashId(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export const seedFor = (id: string) => (hashId(id) >>> 12) / 2 ** 20;

/** Boneco padrão de quem não escolheu: rosto, camisa original da comunidade e número derivados do id (igual em todo aparelho). */
export function avatarFromId(id: string, backName = ''): AvatarLook {
  const h = hashId(id);
  const p = hashId(`${id}:kit`);
  return {
    face: FACES[CHARACTER_FACES[h % CHARACTER_FACES.length]],
    jersey: COMMUNITY_JERSEYS[p % COMMUNITY_JERSEYS.length],
    number: 1 + ((p >>> 4) % 99),
    backName,
    seed: seedFor(id),
  };
}

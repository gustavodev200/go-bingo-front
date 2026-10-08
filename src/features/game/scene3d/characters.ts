import { CHARACTER_IDS, type CharacterId } from '@/contracts';
import { avatarFromId, type AvatarLook } from './avatar-look';

type CharacterLook = Omit<AvatarLook, 'seed'>;

/**
 * Personagens prontos do seletor (setas ← →): combinações curadas que cobrem todos os tons de pele, cabelos e chapéus.
 * Ordem = ordem do seletor. Um id novo no contrato sem entrada aqui não compila.
 */
export const CHARACTERS: Record<CharacterId, CharacterLook> = {
  c01: { body: '#3b82f6', accent: '#fde047', hat: 'party', face: 'grin', skin: '#f5c6a0', hair: '#4a2c12', hairStyle: 'short', pants: '#1e293b' },
  c02: { body: '#ec4899', accent: '#ffffff', hat: 'none', face: 'smile', skin: '#fde0c8', hair: '#f4c542', hairStyle: 'long', pants: '#1e3a8a' },
  c03: { body: '#22c55e', accent: '#1e293b', hat: 'tophat', face: 'smile', skin: '#8d5524', hair: '#1f1308', hairStyle: 'short', pants: '#3f3f46' },
  c04: { body: '#f97316', accent: '#60a5fa', hat: 'cap', face: 'grin', skin: '#e0a47a', hair: '#1f1308', hairStyle: 'short', pants: '#1e3a8a' },
  c05: { body: '#a855f7', accent: '#fde047', hat: 'none', face: 'wow', skin: '#5c3a1e', hair: '#1f1308', hairStyle: 'afro', pants: '#1e293b' },
  c06: { body: '#06b6d4', accent: '#fb7185', hat: 'beanie', face: 'smile', skin: '#fde0c8', hair: '#e8590c', hairStyle: 'bun', pants: '#0f766e' },
  c07: { body: '#f43f5e', accent: '#1e293b', hat: 'none', face: 'grin', skin: '#c68642', hair: '#4a2c12', hairStyle: 'bun', pants: '#1e293b' },
  c08: { body: '#eab308', accent: '#34d399', hat: 'none', face: 'wow', skin: '#f5c6a0', hair: '#ec4899', hairStyle: 'spiky', pants: '#3f3f46' },
  c09: { body: '#3b82f6', accent: '#ffffff', hat: 'beanie', face: 'grin', skin: '#8d5524', hair: '#1f1308', hairStyle: 'long', pants: '#3f3f46' },
  c10: { body: '#22c55e', accent: '#fde047', hat: 'cap', face: 'smile', skin: '#fde0c8', hair: '#a0522d', hairStyle: 'long', pants: '#1e293b' },
  c11: { body: '#ec4899', accent: '#34d399', hat: 'none', face: 'smile', skin: '#e0a47a', hair: '#22c55e', hairStyle: 'afro', pants: '#0f766e' },
  c12: { body: '#a855f7', accent: '#ffffff', hat: 'tophat', face: 'grin', skin: '#f5c6a0', hair: '#f4c542', hairStyle: 'short', pants: '#1e293b' },
  c13: { body: '#06b6d4', accent: '#1e293b', hat: 'none', face: 'wow', skin: '#c68642', hair: '#ec4899', hairStyle: 'long', pants: '#3f3f46' },
  c14: { body: '#f43f5e', accent: '#fde047', hat: 'cap', face: 'grin', skin: '#5c3a1e', hair: '#1f1308', hairStyle: 'short', pants: '#1e3a8a' },
  c15: { body: '#f97316', accent: '#60a5fa', hat: 'party', face: 'smile', skin: '#fde0c8', hair: '#3b82f6', hairStyle: 'bun', pants: '#0f766e' },
  c16: { body: '#eab308', accent: '#fb7185', hat: 'none', face: 'grin', skin: '#8d5524', hair: '#e8590c', hairStyle: 'spiky', pants: '#1e293b' },
};

export const isCharacterId = (value: unknown): value is CharacterId => (CHARACTER_IDS as readonly unknown[]).includes(value);

const cache = new Map<string, AvatarLook>();

/**
 * Aparência de um jogador: o personagem escolhido, ou o boneco derivado do id quando não escolheu (ou o id é desconhecido).
 * O `seed` (fase do piscar/respirar) vem sempre do userId. Memoizado: mesmo jogador + personagem → mesmo objeto.
 */
export function lookFor(userId: string, character?: string | null): AvatarLook {
  const key = `${userId}|${character ?? ''}`;
  let look = cache.get(key);
  if (!look) {
    const derived = avatarFromId(userId);
    look = isCharacterId(character) ? { ...CHARACTERS[character], seed: derived.seed } : derived;
    cache.set(key, look);
  }
  return look;
}

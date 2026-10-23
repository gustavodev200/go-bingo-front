import { CHARACTER_FACES, encodeCharacter, parseCharacter, type CharacterConfig, type CharacterId } from '@/contracts';
import { FACES, avatarFromId, seedFor, type AvatarLook } from './avatar-look';
import { jersey } from './jerseys';

/** Primeira escolha do seletor: o "Craque" com a camisa da casa. */
export const DEFAULT_CHARACTER: CharacterId = encodeCharacter({ face: 'a', jersey: 'gpl', number: 10 });

/** Letras que o atlas do número/nome nas costas sabe desenhar (índice + 1 = código no shader; 0 = vazio). */
export const BACK_GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
export const MAX_BACK_NAME = 12;

/** Apelido → nome de camisa: sem acento, maiúsculo, só letras/números/espaço, até 12 caracteres. */
export function backNameOf(nickname: string | null | undefined): string {
  if (!nickname) return '';
  const folded = nickname
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return folded.slice(0, MAX_BACK_NAME).trim();
}

export function characterLook(config: CharacterConfig, seed: number, nickname?: string | null): AvatarLook {
  const kit = jersey(config.jersey);
  return { face: FACES[config.face], jersey: kit, number: config.number, backName: kit.backName ?? backNameOf(nickname), seed };
}

/** Próximo/anterior rosto mantendo camisa e número. */
export function stepFace(code: CharacterId, delta: number): CharacterId {
  const config = parseCharacter(code) ?? (parseCharacter(DEFAULT_CHARACTER) as CharacterConfig);
  const index = CHARACTER_FACES.indexOf(config.face);
  return encodeCharacter({ ...config, face: CHARACTER_FACES[(index + delta + CHARACTER_FACES.length) % CHARACTER_FACES.length] });
}

const cache = new Map<string, AvatarLook>();

/**
 * Aparência de um jogador: o código escolhido no perfil, ou o boneco derivado do id quando não escolheu (ou o código
 * é desconhecido, ex. personagem antigo). O `seed` vem sempre do userId. Memoizado: mesmos dados → mesmo objeto.
 */
export function lookFor(userId: string, character?: string | null, nickname?: string | null): AvatarLook {
  const key = `${userId}|${character ?? ''}|${nickname ?? ''}`;
  let look = cache.get(key);
  if (!look) {
    const config = parseCharacter(character);
    look = config ? characterLook(config, seedFor(userId), nickname) : avatarFromId(userId, backNameOf(nickname));
    cache.set(key, look);
  }
  return look;
}

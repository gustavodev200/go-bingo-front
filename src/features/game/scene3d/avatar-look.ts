export const BODY_COLORS = ['#f43f5e', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#a855f7', '#ec4899'] as const;
export const ACCENT_COLORS = ['#fde047', '#ffffff', '#1e293b', '#34d399', '#fb7185', '#60a5fa'] as const;
export const HATS = ['none', 'tophat', 'cap', 'beanie', 'party'] as const;
export const FACES = ['smile', 'grin', 'wow'] as const;
export const SKIN_COLORS = ['#fde0c8', '#f5c6a0', '#e0a47a', '#c68642', '#8d5524', '#5c3a1e'] as const;
export const HAIR_COLORS = ['#1f1308', '#4a2c12', '#a0522d', '#f4c542', '#e8590c', '#ec4899', '#22c55e', '#3b82f6'] as const;
export const PANTS_COLORS = ['#1e293b', '#1e3a8a', '#3f3f46', '#0f766e'] as const;

export type Hat = (typeof HATS)[number];
export type Face = (typeof FACES)[number];
export type AvatarLook = { body: string; accent: string; hat: Hat; face: Face; seed: number; skin: string; hair: string; pants: string };

/** FNV-1a 32 bits: rápido, estável entre navegadores. */
export function hashId(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Boneco P0 (PRD E2): derivado do id, igual em qualquer aparelho, nada guardado no back. */
export function avatarFromId(id: string): AvatarLook {
  const h = hashId(id);
  const p = hashId(`${id}:person`); // 2º hash: pele/cabelo/calça independentes do resto
  return {
    body: BODY_COLORS[h % BODY_COLORS.length],
    accent: ACCENT_COLORS[(h >>> 3) % ACCENT_COLORS.length],
    hat: HATS[(h >>> 6) % HATS.length],
    face: FACES[(h >>> 9) % FACES.length],
    seed: (h >>> 12) / 2 ** 20,
    skin: SKIN_COLORS[p % SKIN_COLORS.length],
    hair: HAIR_COLORS[(p >>> 3) % HAIR_COLORS.length],
    pants: PANTS_COLORS[(p >>> 7) % PANTS_COLORS.length],
  };
}

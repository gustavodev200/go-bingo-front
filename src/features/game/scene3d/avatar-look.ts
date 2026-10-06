export const BODY_COLORS = ['#f43f5e', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#a855f7', '#ec4899'] as const;
export const ACCENT_COLORS = ['#fde047', '#ffffff', '#1e293b', '#34d399', '#fb7185', '#60a5fa'] as const;
export const HATS = ['none', 'tophat', 'cap', 'beanie', 'party'] as const;
export const FACES = ['smile', 'grin', 'wow'] as const;

export type Hat = (typeof HATS)[number];
export type Face = (typeof FACES)[number];
export type AvatarLook = { body: string; accent: string; hat: Hat; face: Face; seed: number };

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
  return {
    body: BODY_COLORS[h % BODY_COLORS.length],
    accent: ACCENT_COLORS[(h >>> 3) % ACCENT_COLORS.length],
    hat: HATS[(h >>> 6) % HATS.length],
    face: FACES[(h >>> 9) % FACES.length],
    seed: (h >>> 12) / 2 ** 20,
  };
}

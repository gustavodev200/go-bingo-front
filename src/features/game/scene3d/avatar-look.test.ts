import { ACCENT_COLORS, BODY_COLORS, FACES, HATS, avatarFromId, hashId } from './avatar-look';

const ids = Array.from({ length: 300 }, (_, i) => `00000000-0000-4000-8000-${i.toString(16).padStart(12, '0')}`);

describe('avatarFromId', () => {
  it('is deterministic', () => {
    expect(avatarFromId(ids[7])).toEqual(avatarFromId(ids[7]));
    expect(hashId('abc')).toBe(hashId('abc'));
  });

  it('only produces values from the palettes, with a seed in [0, 1)', () => {
    for (const id of ids) {
      const look = avatarFromId(id);
      expect(BODY_COLORS).toContain(look.body);
      expect(ACCENT_COLORS).toContain(look.accent);
      expect(HATS).toContain(look.hat);
      expect(FACES).toContain(look.face);
      expect(look.seed).toBeGreaterThanOrEqual(0);
      expect(look.seed).toBeLessThan(1);
    }
  });

  it('spreads looks across a room-sized crowd', () => {
    const looks = ids.map(avatarFromId);
    expect(new Set(looks.map((l) => l.body)).size).toBe(BODY_COLORS.length);
    expect(new Set(looks.map((l) => l.hat)).size).toBe(HATS.length);
    expect(new Set(looks.map((l) => l.face)).size).toBe(FACES.length);
  });
});

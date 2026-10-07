import { ACCENT_COLORS, BODY_COLORS, FACES, HAIR_COLORS, HAIR_STYLES, HATS, PANTS_COLORS, SKIN_COLORS, avatarFromId, hashId } from './avatar-look';

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

describe('avatarFromId (person)', () => {
  it('always picks skin, hair and pants from the palettes and spreads skin tones', () => {
    const looks = ids.map(avatarFromId);
    for (const look of looks) {
      expect(SKIN_COLORS).toContain(look.skin);
      expect(HAIR_COLORS).toContain(look.hair);
      expect(PANTS_COLORS).toContain(look.pants);
    }
    expect(new Set(looks.map((l) => l.skin)).size).toBe(SKIN_COLORS.length);
    expect(new Set(looks.map((l) => l.hairStyle)).size).toBe(HAIR_STYLES.length);
  });
});

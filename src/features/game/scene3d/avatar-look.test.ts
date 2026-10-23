import { CHARACTER_FACES } from '@/contracts';
import { BROW_STYLES, EYE_STYLES, FACES, FACE_EXTRAS, HAIR_STYLES, MOUTH_STYLES, avatarFromId, hashId } from './avatar-look';
import { COMMUNITY_JERSEYS } from './jerseys';

const ids = Array.from({ length: 300 }, (_, i) => `00000000-0000-4000-8000-${i.toString(16).padStart(12, '0')}`);

describe('FACES', () => {
  it('has a face for every face id of the contract, in the same order', () => {
    expect(Object.keys(FACES)).toEqual([...CHARACTER_FACES]);
  });

  it('gives every face its own name and covers every hair, eye, brow, mouth and extra', () => {
    const faces = Object.values(FACES);
    expect(new Set(faces.map((f) => f.name)).size).toBe(faces.length);
    expect(new Set(faces.map((f) => f.hairStyle))).toEqual(new Set(HAIR_STYLES));
    expect(new Set(faces.map((f) => f.eyes))).toEqual(new Set(EYE_STYLES));
    expect(new Set(faces.map((f) => f.brows))).toEqual(new Set(BROW_STYLES));
    expect(new Set(faces.map((f) => f.mouth))).toEqual(new Set(MOUTH_STYLES));
    expect(new Set(faces.flatMap((f) => f.extras))).toEqual(new Set(FACE_EXTRAS));
  });
});

describe('avatarFromId', () => {
  it('is deterministic', () => {
    expect(avatarFromId(ids[7])).toEqual(avatarFromId(ids[7]));
    expect(hashId('abc')).toBe(hashId('abc'));
  });

  it('dresses the default player in an original community jersey (never a club or a political one)', () => {
    for (const id of ids) {
      const look = avatarFromId(id);
      expect(COMMUNITY_JERSEYS).toContain(look.jersey);
      expect(look.number).toBeGreaterThanOrEqual(1);
      expect(look.number).toBeLessThanOrEqual(99);
      expect(look.seed).toBeGreaterThanOrEqual(0);
      expect(look.seed).toBeLessThan(1);
    }
  });

  it('spreads faces and jerseys across a room-sized crowd', () => {
    const looks = ids.map((id) => avatarFromId(id));
    expect(new Set(looks.map((l) => l.face)).size).toBe(CHARACTER_FACES.length);
    expect(new Set(looks.map((l) => l.jersey)).size).toBe(COMMUNITY_JERSEYS.length);
  });
});

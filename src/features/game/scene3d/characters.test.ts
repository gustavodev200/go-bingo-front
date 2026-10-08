import { CHARACTER_IDS } from '@/contracts';
import { HAIR_STYLES, HATS, SKIN_COLORS, avatarFromId } from './avatar-look';
import { CHARACTERS, isCharacterId, lookFor } from './characters';

const ID = '00000000-0000-4000-8000-000000000042';

describe('CHARACTERS', () => {
  it('has a look for every character id of the contract, in the same order', () => {
    expect(Object.keys(CHARACTERS)).toEqual([...CHARACTER_IDS]);
  });

  it('covers every skin tone, hair style and hat', () => {
    const looks = Object.values(CHARACTERS);
    expect(new Set(looks.map((l) => l.skin))).toEqual(new Set(SKIN_COLORS));
    expect(new Set(looks.map((l) => l.hairStyle))).toEqual(new Set(HAIR_STYLES));
    expect(new Set(looks.map((l) => l.hat))).toEqual(new Set(HATS));
  });
});

describe('lookFor', () => {
  it('uses the chosen character, keeping the per-player seed', () => {
    const look = lookFor(ID, 'c05');
    expect(look).toMatchObject(CHARACTERS.c05);
    expect(look.seed).toBe(avatarFromId(ID).seed);
  });

  it('falls back to the id-derived avatar when nothing (or an unknown id) was chosen', () => {
    expect(lookFor(ID, null)).toEqual(avatarFromId(ID));
    expect(lookFor(ID, 'zz9')).toEqual(avatarFromId(ID));
    expect(isCharacterId('zz9')).toBe(false);
  });

  it('returns the same object for the same player and character (stable across ticks)', () => {
    expect(lookFor(ID, 'c02')).toBe(lookFor(ID, 'c02'));
  });
});

import { CHARACTER_FACES, JERSEY_IDS } from '@/contracts';
import { FACES, avatarFromId } from './avatar-look';
import { DEFAULT_CHARACTER, backNameOf, lookFor, stepFace } from './characters';
import { ALL_JERSEYS, JERSEYS, jersey, searchJerseys } from './jerseys';

const ID = '00000000-0000-4000-8000-000000000042';

describe('jersey catalog', () => {
  it('has one entry per jersey id of the contract, in the same order', () => {
    expect(Object.keys(JERSEYS)).toEqual([...JERSEY_IDS]);
  });

  it('has the 20 Série A 2026 clubs, Real Madrid, Barcelona and both political jerseys', () => {
    const names = (category: string) => ALL_JERSEYS.filter((j) => j.category === category).map((j) => j.name);
    expect(names('brasileirao')).toHaveLength(20);
    expect(names('brasileirao')).toEqual(
      expect.arrayContaining(['Flamengo', 'Palmeiras', 'Cruzeiro', 'Mirassol', 'Fluminense', 'Bahia', 'Botafogo', 'São Paulo', 'Red Bull Bragantino', 'Corinthians']),
    );
    expect(names('brasileirao')).toEqual(
      expect.arrayContaining(['Grêmio', 'Vasco da Gama', 'Atlético Mineiro', 'Santos', 'Internacional', 'Coritiba', 'Athletico Paranaense', 'Chapecoense', 'Remo', 'Vitória']),
    );
    expect(names('internacional')).toEqual(['Real Madrid', 'Barcelona']);
    expect(names('tematica')).toEqual(['Lula', 'Bolsonaro']);
  });

  it('treats both political jerseys the same way: emblem pattern, fixed back name and suggested number', () => {
    for (const j of [jersey('lul'), jersey('bol')]) {
      expect(['star', 'diamond']).toContain(j.pattern);
      expect(j.backName).toBeTruthy();
      expect(j.defaultNumber).toBeGreaterThan(0);
    }
  });

  it('only uses valid #rrggbb colors and fills in collar, sleeves and ink', () => {
    for (const j of ALL_JERSEYS) {
      for (const c of [j.primary, j.secondary, j.accent, j.shorts, j.socks, j.collar, j.sleeves, j.ink, j.badge ?? '#000000']) expect(c, j.name).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('searches ignoring accents and case, or lists a category', () => {
    expect(searchJerseys('gremio').map((j) => j.id)).toEqual(['gre']);
    expect(searchJerseys('SAO').map((j) => j.id)).toContain('spa');
    expect(searchJerseys('', 'internacional').map((j) => j.id)).toEqual(['rma', 'bar']);
  });
});

describe('lookFor', () => {
  it('uses the chosen face, jersey, number and nickname, keeping the per-player seed', () => {
    const look = lookFor(ID, 'dvas07', 'Zé Ninguém!');
    expect(look).toMatchObject({ face: FACES.d, jersey: jersey('vas'), number: 7, backName: 'ZE NINGUEM' });
    expect(look.seed).toBe(avatarFromId(ID).seed);
  });

  it('prints the themed name instead of the nickname on political jerseys', () => {
    expect(lookFor(ID, 'alul13', 'Ana').backName).toBe('LULA');
    expect(lookFor(ID, 'abol22', 'Ana').backName).toBe('BOLSONARO');
  });

  it('falls back to the id-derived player when nothing (or a legacy/unknown code) was chosen', () => {
    expect(lookFor(ID, null)).toEqual(avatarFromId(ID));
    expect(lookFor(ID, 'c05')).toEqual(avatarFromId(ID));
  });

  it('returns the same object for the same player, code and nickname (stable across ticks)', () => {
    expect(lookFor(ID, 'bpal09', 'Ana')).toBe(lookFor(ID, 'bpal09', 'Ana'));
  });
});

describe('helpers', () => {
  it('steps faces keeping jersey and number, wrapping around', () => {
    expect(stepFace('afla10', 1)).toBe('bfla10');
    expect(stepFace('afla10', -1)).toBe(`${CHARACTER_FACES.at(-1)}fla10`);
    expect(stepFace('junk', 1)).toBe(stepFace(DEFAULT_CHARACTER, 1));
  });

  it('turns nicknames into back names the glyph atlas can draw (max 12)', () => {
    expect(backNameOf('João_10')).toBe('JOAO 10');
    expect(backNameOf('abcdefghijklmnop')).toBe('ABCDEFGHIJKL');
    expect(backNameOf(null)).toBe('');
  });
});

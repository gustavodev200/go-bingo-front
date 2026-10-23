import { BoxGeometry, Color } from 'three';
import { BACK_GLYPHS } from './characters';
import { attachKitAttributes, glyphCode, packHex, packName, writeKit } from './jersey-shader';
import { lookFor } from './characters';
import { JERSEY_PATTERNS } from './jerseys';

describe('jersey shader data', () => {
  it('packs #rrggbb into a float exactly (24 bits fit the float32 mantissa)', () => {
    for (const hex of ['#000000', '#ffffff', '#c4122e', '#0d80bf']) {
      const packed = packHex(hex);
      expect(Math.fround(packed)).toBe(packed);
      expect(packed.toString(16).padStart(6, '0')).toBe(hex.slice(1));
    }
  });

  it('packs two glyphs per float, empty for spaces and unknown characters', () => {
    expect(glyphCode('A')).toBe(1);
    expect(glyphCode('9')).toBe(BACK_GLYPHS.length);
    expect(glyphCode(' ')).toBe(0);
    const [first] = packName('AB');
    expect(Math.floor(first / 64)).toBe(1);
    expect(first % 64).toBe(2);
    expect(packName('')).toEqual(Array(8).fill(0));
  });

  it('writes a player kit into its instance slot, so two players share the mesh with different jerseys', () => {
    const geometry = new BoxGeometry();
    const attrs = attachKitAttributes(geometry, 4);
    writeKit(attrs, 0, lookFor('a', 'afla10', 'Ana'), new Color(0, 0, 0), 1);
    writeKit(attrs, 1, lookFor('b', 'bbar07', 'Bia'), new Color(0, 0, 0), 1);
    expect(attrs.colors.getX(0)).toBe(packHex('#c4122e'));
    expect(attrs.colors.getX(1)).toBe(packHex('#a50044'));
    expect(attrs.more.getY(0)).toBe(JERSEY_PATTERNS.indexOf('hoops'));
    expect(attrs.more.getW(0)).toBe(10);
    expect(attrs.more.getW(1)).toBe(7);
    expect(attrs.name0.getX(0)).toBe(packName('ANA')[0]);
    expect(geometry.getAttribute('kitColors')).toBe(attrs.colors);
    geometry.dispose();
  });
});

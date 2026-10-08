import { Vector3, type BufferGeometry } from 'three';
import { FACE, HEAD_R, createAvatarGeometries, disposeAvatarGeometries } from './avatar-geometry';

const origin = (m: (typeof FACE.eye)[number]) => new Vector3().setFromMatrixPosition(m);

describe('avatar geometries', () => {
  const geo = createAvatarGeometries();
  afterAll(() => disposeAvatarGeometries(geo));

  const all: [string, BufferGeometry][] = [
    ...Object.entries(geo).filter((e): e is [string, BufferGeometry] => 'attributes' in e[1]),
    ...Object.entries(geo.mouths),
    ...Object.entries(geo.hair),
    ...Object.entries(geo.hats),
  ];

  it('builds every piece with finite positions and normals', () => {
    for (const [name, g] of all) {
      const position = g.getAttribute('position');
      expect(position.count, name).toBeGreaterThan(0);
      expect(g.getAttribute('normal').count, name).toBe(position.count);
      expect(Array.from(position.array).every(Number.isFinite), name).toBe(true);
    }
  });

  it('paints a vertex color on every piece drawn with vertexColors (only blush and fake shadow go without)', () => {
    for (const [name, g] of all) {
      if (name === 'cheeks' || name === 'shadow') continue;
      expect(g.getAttribute('color')?.count, name).toBe(g.getAttribute('position').count);
    }
  });

  it('places the face symmetrically on the front of the head: brows over eyes over mouth', () => {
    const [left, right] = FACE.eye.map(origin);
    expect(left.x).toBeCloseTo(-right.x);
    expect(left.z).toBeGreaterThan(HEAD_R * 0.8);
    expect(origin(FACE.brow[1]).y).toBeGreaterThan(right.y);
    expect(origin(FACE.mouth).y).toBeLessThan(right.y);
    expect(origin(FACE.mouth).x).toBeCloseTo(0);
  });
});

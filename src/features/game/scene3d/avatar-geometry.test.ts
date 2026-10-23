import { Vector3, type BufferGeometry } from 'three';
import { FACES } from './avatar-look';
import { FACE, HEAD_R, createAvatarGeometries, disposeAvatarGeometries, trianglesOf } from './avatar-geometry';

const origin = (m: (typeof FACE.eye)[number]) => new Vector3().setFromMatrixPosition(m);

describe('avatar geometries', () => {
  const geo = createAvatarGeometries();
  afterAll(() => disposeAvatarGeometries(geo));

  const all: [string, BufferGeometry][] = [
    ...Object.entries(geo).filter((e): e is [string, BufferGeometry] => 'attributes' in (e[1] as object)),
    ...Object.entries(geo.mouths),
    ...Object.entries(geo.hair),
    ...Object.entries(geo.extras),
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
    expect(origin(FACE.unibrow).x).toBeCloseTo(0);
  });

  it('keeps every player within the low-poly budget (< 5k triangles, even the most decorated face)', () => {
    const body = ['torso', 'hips', 'collar', 'head', 'crown', 'shadow'] as const;
    const paired = ['legs', 'shorts', 'socks', 'boots', 'arms', 'hands', 'sclera', 'pupils', 'brows', 'cheeks', 'halfLids'] as const;
    const base = body.reduce((n, k) => n + trianglesOf(geo[k]), 0) + paired.reduce((n, k) => n + 2 * trianglesOf(geo[k]), 0);
    for (const face of Object.values(FACES)) {
      const hair = face.hairStyle === 'bald' ? 0 : trianglesOf(geo.hair[face.hairStyle]);
      const extras = face.extras.reduce((n, e) => n + trianglesOf(geo.extras[e]), 0);
      const total = base + hair + extras + trianglesOf(geo.mouths[face.mouth]);
      expect(total, face.name).toBeLessThan(5000);
    }
  });
});

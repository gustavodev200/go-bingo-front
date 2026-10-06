import { PerspectiveCamera, Vector3 } from 'three';
import { approach, cameraFor, focusOn, orbitPosition } from './camera';
import { BALL_REST, GLOBE_CENTER } from './globe';
import { TELAO_CENTER, TELAO_SIZE } from './telao';
import { MAX_SLOTS, slotPosition } from './slots';

function project(aspect: number, yaw = 0) {
  const setup = cameraFor(aspect);
  const cam = new PerspectiveCamera(setup.fov, aspect, 0.1, 200);
  cam.position.set(...orbitPosition(setup, yaw));
  cam.lookAt(...setup.target);
  cam.updateMatrixWorld();
  return (p: readonly [number, number, number], dy = 0) => new Vector3(p[0], p[1] + dy, p[2]).project(cam);
}

describe('cameraFor', () => {
  it.each([0.5, 1.15, 2.2])('frames every avatar (feet and head) at aspect %s', (aspect) => {
    const toNdc = project(aspect);
    for (let s = 0; s < MAX_SLOTS; s++) {
      for (const dy of [0, 1.3]) {
        const v = toNdc(slotPosition(s), dy);
        expect(Math.abs(v.x)).toBeLessThanOrEqual(1);
        expect(Math.abs(v.y)).toBeLessThanOrEqual(1);
      }
    }
  });

  it('keeps the crowd framed while dragged to the yaw limit', () => {
    const toNdc = project(1.15, 0.26);
    for (let s = 0; s < MAX_SLOTS; s++) expect(Math.abs(toNdc(slotPosition(s)).x)).toBeLessThanOrEqual(1);
  });

  it('orbitPosition with yaw 0 is the base position', () => {
    const setup = cameraFor(1);
    orbitPosition(setup, 0).forEach((v, i) => expect(v).toBeCloseTo(setup.position[i]));
  });
});

describe('cameraFor(game)', () => {
  function projector(aspect: number) {
    const setup = cameraFor(aspect, 'game');
    const cam = new PerspectiveCamera(setup.fov, aspect, 0.1, 200);
    cam.position.set(...setup.position);
    cam.lookAt(...setup.target);
    cam.updateMatrixWorld();
    return (x: number, y: number, z: number) => new Vector3(x, y, z).project(cam);
  }

  it.each([0.5, 1.15, 2.2])('frames the whole screen, the globe and the ball at aspect %s', (aspect) => {
    const p = projector(aspect);
    const [cx, cy, cz] = TELAO_CENTER;
    const [w, h] = TELAO_SIZE;
    const points: [number, number, number][] = [
      [cx - w / 2, cy - h / 2, cz],
      [cx + w / 2, cy + h / 2, cz],
      [cx - w / 2, cy + h / 2, cz],
      [cx + w / 2, cy - h / 2, cz],
      [GLOBE_CENTER[0] + 0.8, GLOBE_CENTER[1], GLOBE_CENTER[2]],
      [GLOBE_CENTER[0], GLOBE_CENTER[1] - 0.8, GLOBE_CENTER[2]],
      [...BALL_REST],
    ];
    for (const point of points) {
      const v = p(...point);
      expect(Math.abs(v.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(v.y)).toBeLessThanOrEqual(1);
    }
  });
});

describe('focusOn', () => {
  it('centers the avatar in view', () => {
    const slot = [2.2, 0.4, 0.1] as const;
    const setup = focusOn(slot);
    const cam = new PerspectiveCamera(setup.fov, 1, 0.1, 200);
    cam.position.set(...setup.position);
    cam.lookAt(...setup.target);
    cam.updateMatrixWorld();
    const v = new Vector3(slot[0], slot[1] + 0.9, slot[2]).project(cam);
    expect(Math.abs(v.x)).toBeLessThan(0.05);
    expect(Math.abs(v.y)).toBeLessThan(0.05);
  });
});

describe('approach', () => {
  it('moves toward the target, converges and never overshoots', () => {
    let cur: readonly [number, number, number] = [0, 0, 0];
    const target = [10, -4, 2] as const;
    cur = approach(cur, target, 0.1);
    expect(cur[0]).toBeGreaterThan(0);
    expect(cur[0]).toBeLessThan(10);
    for (let i = 0; i < 200; i++) cur = approach(cur, target, 0.05);
    cur.forEach((v, i) => expect(v).toBeCloseTo(target[i], 3));
    expect(approach([0, 0, 0], target, 100)).toEqual([10, -4, 2]);
  });
});

import { PerspectiveCamera, Vector3 } from 'three';
import { approach, cameraFor, focusOn, orbitPosition } from './camera';
import { BALL_REST, GLOBE_CENTER } from './globe';
import { SCOREBOARD_CENTER, SCOREBOARD_SIZE } from './scoreboard';
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
    const [cx, cy, cz] = SCOREBOARD_CENTER;
    const [w, h] = SCOREBOARD_SIZE;
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

describe('cameraFor(game) — plateia visível', () => {
  it.each([0.5, 1.15, 2.2])('keeps the center avatars (feet to head) on screen at aspect %s', (aspect) => {
    const setup = cameraFor(aspect, 'game');
    const cam = new PerspectiveCamera(setup.fov, aspect, 0.1, 200);
    cam.position.set(...setup.position);
    cam.lookAt(...setup.target);
    cam.updateMatrixWorld();
    // 9 primeiros slots = frente (5 do meio) + fileira do meio (4 do meio)
    for (let s = 0; s < 9; s++) {
      const p = slotPosition(s);
      for (const dy of [0.2, 1.5]) {
        const v = new Vector3(p[0], p[1] + dy, p[2]).project(cam);
        expect(Math.abs(v.x)).toBeLessThanOrEqual(1);
        expect(Math.abs(v.y)).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe('cameraFor(lobby, spread)', () => {
  const distance = (s: ReturnType<typeof cameraFor>) => Math.hypot(s.position[0] - s.target[0], s.position[1] - s.target[1], s.position[2] - s.target[2]);

  it('comes closer when only the center avatars are present', () => {
    expect(distance(cameraFor(0.9, 'lobby', 0.55))).toBeLessThan(distance(cameraFor(0.9, 'lobby')) * 0.7);
  });

  it.each([0.5, 1.15, 2.2])('still frames every present avatar at aspect %s', (aspect) => {
    for (const count of [1, 2, 5, 9, MAX_SLOTS]) {
      const present = Array.from({ length: count }, (_, s) => slotPosition(s));
      const spread = Math.max(...present.map((p) => Math.abs(p[0])));
      const setup = cameraFor(aspect, 'lobby', spread);
      const cam = new PerspectiveCamera(setup.fov, aspect, 0.1, 200);
      cam.position.set(...setup.position);
      cam.lookAt(...setup.target);
      cam.updateMatrixWorld();
      for (const p of present) {
        for (const dy of [0, 1.3]) {
          const v = new Vector3(p[0], p[1] + dy, p[2]).project(cam);
          expect(Math.abs(v.x)).toBeLessThanOrEqual(1);
          expect(Math.abs(v.y)).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it('never goes wider than the full-room framing', () => {
    expect(cameraFor(1, 'lobby', 99)).toEqual(cameraFor(1, 'lobby'));
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

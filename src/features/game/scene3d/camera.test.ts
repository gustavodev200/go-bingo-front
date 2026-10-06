import { PerspectiveCamera, Vector3 } from 'three';
import { cameraFor, orbitPosition } from './camera';
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

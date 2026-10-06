import type { Vec3 } from './slots';

export type CameraSetup = { position: Vec3; target: Vec3; fov: number };

const TARGET: Vec3 = [0, 1.1, -0.6];
const FOV = 45;
const HALF_WIDTH = 5.6;
const HALF_HEIGHT = 3.2;
const MAX_DISTANCE = 26;

/** Enquadra plateia + palco para qualquer aspect (retrato da região do canvas, paisagem, desktop). */
export function cameraFor(aspect: number): CameraSetup {
  const tanHalf = Math.tan(((FOV / 2) * Math.PI) / 180);
  const forWidth = HALF_WIDTH / (tanHalf * Math.max(aspect, 0.3));
  const forHeight = HALF_HEIGHT / tanHalf;
  const distance = Math.min(Math.max(forWidth, forHeight), MAX_DISTANCE);
  return { fov: FOV, target: TARGET, position: [TARGET[0], TARGET[1] + distance * 0.32, TARGET[2] + distance] };
}

/** Gira a câmera em torno do alvo (arrasto do lobby, ±15°). */
export function orbitPosition(setup: CameraSetup, yaw: number): Vec3 {
  const dx = setup.position[0] - setup.target[0];
  const dz = setup.position[2] - setup.target[2];
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  return [setup.target[0] + dx * cos + dz * sin, setup.position[1], setup.target[2] - dx * sin + dz * cos];
}

import type { Vec3 } from './slots';

export type CameraSetup = { position: Vec3; target: Vec3; fov: number };
export type CameraView = 'lobby' | 'game';

const FOV = 45;
const MAX_DISTANCE = 26;
const VIEWS: Record<CameraView, { target: Vec3; halfWidth: number; halfHeight: number; elevation: number }> = {
  lobby: { target: [0, 1.1, -0.6], halfWidth: 5.6, halfHeight: 3.2, elevation: 0.32 },
  // game: de cima da plateia — bonecos em primeiro plano, telão e globo ao fundo.
  game: { target: [0, 2.4, -0.5], halfWidth: 4.5, halfHeight: 3.25, elevation: 0.45 },
};

/** Menor meia-largura do lobby: mesmo com 1–2 jogadores o palco e o globo continuam em cena. */
const MIN_LOBBY_HALF_WIDTH = 3.2;
/** Folga lateral além do boneco mais afastado do centro (largura do boneco + respiro). */
const SPREAD_MARGIN = 1.3;

/**
 * Enquadramento por aspect: `lobby` = plateia + palco; `game` = telão + globo (plateia aparece embaixo quando cabe).
 * `spread` (lobby) = maior |x| entre os bonecos presentes: sala vazia aproxima a câmera e eles aparecem grandes.
 */
export function cameraFor(aspect: number, view: CameraView = 'lobby', spread?: number): CameraSetup {
  const v = VIEWS[view];
  const halfWidth = view === 'lobby' && spread !== undefined ? Math.min(v.halfWidth, Math.max(MIN_LOBBY_HALF_WIDTH, spread + SPREAD_MARGIN)) : v.halfWidth;
  const tanHalf = Math.tan(((FOV / 2) * Math.PI) / 180);
  const forWidth = halfWidth / (tanHalf * Math.max(aspect, 0.3));
  const forHeight = v.halfHeight / tanHalf;
  const distance = Math.min(Math.max(forWidth, forHeight), MAX_DISTANCE);
  return { fov: FOV, target: v.target, position: [v.target[0], v.target[1] + distance * v.elevation, v.target[2] + distance] };
}

/** Cena de vitória: câmera de frente para o avatar vencedor. */
export function focusOn(slot: Vec3): CameraSetup {
  const target: Vec3 = [slot[0], slot[1] + 0.9, slot[2]];
  return { fov: 40, target, position: [slot[0], slot[1] + 1.6, slot[2] + 4.2] };
}

/** Gira a câmera em torno do alvo (arrasto do lobby, ±15°). */
export function orbitPosition(setup: CameraSetup, yaw: number): Vec3 {
  const dx = setup.position[0] - setup.target[0];
  const dz = setup.position[2] - setup.target[2];
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  return [setup.target[0] + dx * cos + dz * sin, setup.position[1], setup.target[2] - dx * sin + dz * cos];
}

/** Aproximação exponencial independente do FPS (sem ultrapassar o alvo). */
export function approach(current: Vec3, target: Vec3, dtSeconds: number, rate = 3): Vec3 {
  const k = 1 - Math.exp(-rate * Math.max(0, dtSeconds));
  return [current[0] + (target[0] - current[0]) * k, current[1] + (target[1] - current[1]) * k, current[2] + (target[2] - current[2]) * k];
}

import type { Vec3 } from './slots';

export const GLOBE_CENTER: Vec3 = [3.6, 1.6, -3.6];
/** Onde a bola sorteada para e flutua: à frente do palco, perto do globo. */
export const BALL_REST: Vec3 = [1.8, 2.0, -2.6];
export const BALL_FLIGHT_MS = 1600;
export const BALL_SHOW_MS = 3500;
const POP_END = 0.15;
const LAND = 0.7;
const IDLE_SPIN = 0.4;
const BURST_SPIN = 5;
const BURST_DECAY_MS = 600;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

/** Trajetória cosmética da bola: sai do globo, arco até BALL_REST, flutua, encolhe e some. */
export function ballFlight(elapsedMs: number): { position: Vec3; scale: number; visible: boolean } {
  const t = Math.max(0, elapsedMs);
  const p = t / BALL_FLIGHT_MS;
  if (t >= BALL_SHOW_MS) return { position: BALL_REST, scale: 0, visible: false };
  if (p < POP_END) return { position: GLOBE_CENTER, scale: clamp01(p / POP_END), visible: true };
  if (p < LAND) {
    const k = ease((p - POP_END) / (LAND - POP_END));
    const arc = Math.sin(k * Math.PI) * 1.0;
    return {
      position: [
        GLOBE_CENTER[0] + (BALL_REST[0] - GLOBE_CENTER[0]) * k,
        GLOBE_CENTER[1] + (BALL_REST[1] - GLOBE_CENTER[1]) * k + arc,
        GLOBE_CENTER[2] + (BALL_REST[2] - GLOBE_CENTER[2]) * k,
      ],
      scale: 1,
      visible: true,
    };
  }
  const shrink = clamp01((BALL_SHOW_MS - t) / 300);
  return { position: [BALL_REST[0], BALL_REST[1] + 0.06 * Math.sin((t - LAND * BALL_FLIGHT_MS) / 250), BALL_REST[2]], scale: shrink, visible: true };
}

/** Velocidade angular do globo (rad/s): giro lento + arranque logo após cada sorteio. */
export function globeSpin(now: number, lastDrawAt: number): number {
  if (lastDrawAt <= 0) return IDLE_SPIN;
  return IDLE_SPIN + BURST_SPIN * Math.exp(-Math.max(0, now - lastDrawAt) / BURST_DECAY_MS);
}

function rand(i: number, salt: number) {
  const x = Math.sin((i + 1) * 91.17 + salt * 13.73) * 43758.5453;
  return x - Math.floor(x);
}

/** Bolinhas chacoalhando dentro da gaiola (offset relativo ao centro do globo). */
export function innerBall(index: number, now: number): Vec3 {
  const r = 0.2 + rand(index, 1) * 0.3;
  const a = now / (300 + rand(index, 2) * 400) + rand(index, 3) * 6.28;
  const b = now / (500 + rand(index, 4) * 500) + rand(index, 5) * 6.28;
  return [r * Math.cos(a) * Math.sin(b), r * Math.cos(b) * 0.9, r * Math.sin(a) * Math.sin(b)];
}

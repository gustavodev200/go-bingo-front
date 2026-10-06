import type { Vec3 } from './slots';

export const CONFETTI_COLORS = ['#fde047', '#f472b6', '#60a5fa', '#34d399', '#fb923c'] as const;

/** Onda de "lâmpadas de game show": cada lâmpada atrasada em relação à vizinha. */
export function bulbLevel(index: number, now: number): number {
  return 0.35 + 0.65 * Math.max(0, Math.sin(now / 180 - index * 0.6));
}

function rand(index: number, salt: number): number {
  const x = Math.sin((index + 1) * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/** Confete caindo em loop dentro do salão; determinístico por índice. */
export function confettiParticle(index: number, elapsedMs: number): { position: Vec3; rotation: Vec3; colorIndex: number } {
  const t = elapsedMs / 1000;
  const fall = 1.2 + rand(index, 3) * 1.2;
  const y = 7 - ((t * fall + rand(index, 4) * 7) % 7);
  const sway = Math.sin(t * 2 + rand(index, 5) * 6) * 0.3;
  return {
    position: [(rand(index, 1) - 0.5) * 12 + sway, y, (rand(index, 2) - 0.5) * 6],
    rotation: [t * (2 + rand(index, 6) * 3), t * (1 + rand(index, 7) * 2), 0],
    colorIndex: Math.floor(rand(index, 8) * CONFETTI_COLORS.length),
  };
}

import type { Reaction } from '../store';

/** Última reação de cada jogador (uma bolha por boneco), na ordem em que chegaram. */
export function latestPerUser(reactions: readonly Reaction[]): Reaction[] {
  const byUser = new Map<string, Reaction>();
  for (const r of reactions) {
    byUser.delete(r.userId);
    byUser.set(r.userId, r);
  }
  return [...byUser.values()];
}

export interface BubbleFrame {
  visible: boolean;
  /** Subida acima da cabeça, em unidades da cena. */
  rise: number;
  opacity: number;
  scale: number;
}

const POP = 0.15;
const FADE_FROM = 0.8;

/** Quadro da bolha em `t` ∈ [0, 1) do tempo de vida: estoura, sobe devagar e some no fim. */
export function bubbleFrame(t: number): BubbleFrame {
  if (t < 0 || t >= 1) return { visible: false, rise: 0, opacity: 0, scale: 0 };
  return {
    visible: true,
    rise: t * 0.6,
    scale: Math.min(1, t / POP),
    opacity: t < FADE_FROM ? 1 : (1 - t) / (1 - FADE_FROM),
  };
}

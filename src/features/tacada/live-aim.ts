import type { TacadaAim } from '@/contracts';

/**
 * The opponent's live aim, outside React: it changes ~15 times per second and only the
 * canvas reads it, so going through the store would re-render the whole table for nothing.
 */
let current: { aim: TacadaAim; at: number } | null = null;
const listeners = new Set<() => void>();

export function setRemoteAim(aim: TacadaAim): void {
  current = { aim, at: Date.now() };
  listeners.forEach((fn) => fn());
}

export function clearRemoteAim(): void {
  current = null;
  listeners.forEach((fn) => fn());
}

/** Latest aim, or null when none arrived in the last `maxAgeMs`. */
export function remoteAim(maxAgeMs = 4_000): TacadaAim | null {
  if (!current || Date.now() - current.at > maxAgeMs) return null;
  return current.aim;
}

export function onRemoteAim(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

import type { SceneMember } from './choreographer';
import { MAX_SLOTS } from './slots';

/** Prefixo dos ids falsos (formato de uuid, nunca gerado pelo Supabase). */
export const BOT_ID_PREFIX = 'b0000000-0000-4000-8000-';

/** `?bots=N` → total de bonecos desejado (inclui você). Só em dev ou com NEXT_PUBLIC_ENABLE_BOTS=1. */
export function parseBots(search: string, enabled: boolean): number {
  if (!enabled) return 0;
  const raw = Number(new URLSearchParams(search).get('bots'));
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  return Math.min(MAX_SLOTS, Math.floor(raw));
}

/** Membros falsos só para a cena (nunca vão à store, à HUD nem ao servidor). */
export function botMembers(count: number, takenSlots: number[]): SceneMember[] {
  const taken = new Set(takenSlots);
  const free = Array.from({ length: MAX_SLOTS }, (_, slot) => slot).filter((slot) => !taken.has(slot));
  return free.slice(0, Math.max(0, count)).map((slot, i) => ({
    userId: `${BOT_ID_PREFIX}${(i + 1).toString().padStart(12, '0')}`,
    slot,
    connected: true,
    hasCard: true,
  }));
}

export function botName(userId: string): string | null {
  return userId.startsWith(BOT_ID_PREFIX) ? `Bot ${Number(userId.slice(BOT_ID_PREFIX.length))}` : null;
}

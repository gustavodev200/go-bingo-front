import type { DominoActions } from '@/features/domino/connection';

/** Every dominó action as a resolved mock, for component tests. */
export function dominoActions(): DominoActions {
  const ok = () => vi.fn(async () => true);
  return {
    leave: ok(),
    ready: ok(),
    setVisibility: ok(),
    setRules: ok(),
    start: ok(),
    rematch: ok(),
    play: ok(),
    draw: ok(),
    emote: ok(),
  };
}

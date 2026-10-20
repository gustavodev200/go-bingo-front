import type { BjActions } from '@/features/blackjack/connection';

/** Every blackjack action as a resolved mock, for component tests. */
export function bjActions(): BjActions {
  const ok = () => vi.fn(async () => true);
  return {
    leave: ok(),
    ready: ok(),
    addBot: ok(),
    removeBot: ok(),
    setVisibility: ok(),
    setStake: ok(),
    setRules: ok(),
    start: ok(),
    rematch: ok(),
    bet: ok(),
    insurance: ok(),
    act: ok(),
    emote: ok(),
  };
}

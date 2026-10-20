import type { DamasActions } from '@/features/damas/connection';

/** Every damas action as a resolved mock, for component tests. */
export function damasActions(): DamasActions {
  const ok = () => vi.fn(async () => true);
  return {
    leave: ok(),
    ready: ok(),
    setVisibility: ok(),
    setStake: ok(),
    setRules: ok(),
    start: ok(),
    rematch: ok(),
    move: ok(),
    resign: ok(),
    offerDraw: ok(),
    answerDraw: ok(),
    emote: ok(),
  };
}

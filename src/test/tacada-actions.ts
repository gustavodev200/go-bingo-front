import type { TacadaActions } from '@/features/tacada/connection';

/** Every Tacada action as a resolved mock, for component tests. */
export function tacadaActions(): TacadaActions {
  const ok = () => vi.fn(async () => true);
  return {
    leave: ok(),
    ready: ok(),
    setVisibility: ok(),
    setStake: ok(),
    setRules: ok(),
    start: ok(),
    rematch: ok(),
    shoot: ok(),
    aim: vi.fn(),
    resign: ok(),
    emote: ok(),
  };
}

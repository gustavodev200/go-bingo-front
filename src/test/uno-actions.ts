import type { UnoActions } from '@/features/uno/connection';

/** Every UNO action as a resolved mock, for component tests. */
export function unoActions(): UnoActions {
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
    playCard: ok(),
    draw: ok(),
    pass: ok(),
    challenge: ok(),
    callUno: ok(),
    catchUno: ok(),
    emote: ok(),
  };
}

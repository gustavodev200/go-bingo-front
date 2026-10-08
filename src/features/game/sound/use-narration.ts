'use client';

import { useEffect } from 'react';
import { useGameStore } from '../store';
import { ballPhrase, sharedNarrator, type Narrator } from './narration';
import { usePersistedFlag } from './use-persisted-flag';

/** Preferência da narração (ligada por padrão; quem desliga fica com ela desligada no aparelho). */
export function useNarrationEnabled(): [boolean, (enabled: boolean) => void] {
  return usePersistedFlag('go-bingo:narration', true);
}

/**
 * Fala cada bola nova ("B, 7"). Primeiro estado e ressincronização após queda são silenciosos:
 * só narra o que chegou ao vivo, nunca o atraso acumulado.
 */
export function useNarration(enabled: boolean, narrator: Narrator = sharedNarrator()) {
  useEffect(() => {
    if (!enabled || !narrator.supported) return;
    let prevCount: number | null = null;
    const check = () => {
      const { snapshot, connection } = useGameStore.getState();
      const drawn = snapshot?.game?.drawn;
      if (!drawn || connection === 'reconnecting') {
        prevCount = null;
        return;
      }
      if (prevCount !== null && drawn.length > prevCount) narrator.speak(ballPhrase(drawn[drawn.length - 1]));
      prevCount = drawn.length;
    };
    check();
    return useGameStore.subscribe(check);
  }, [enabled, narrator]);
}

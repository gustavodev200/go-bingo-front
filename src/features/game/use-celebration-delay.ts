'use client';

import { useEffect, useRef, useState } from 'react';

export const CELEBRATION_MS = 1200;

/**
 * Ao iniciar a partida no 3D, segura o lobby por um instante (confete) antes de trocar para a tela do jogo.
 * `inGame === null` = estado ainda desconhecido (sem snapshot): chegar/recarregar no meio da partida não comemora.
 */
export function useCelebrationDelay(inGame: boolean | null, enabled: boolean, delayMs = CELEBRATION_MS): boolean {
  const [shownGame, setShownGame] = useState(inGame === true);
  const previous = useRef<boolean | null>(inGame);

  useEffect(() => {
    if (inGame === null) return;
    const wasInGame = previous.current;
    previous.current = inGame;
    if (!inGame || wasInGame !== false) {
      setShownGame(inGame);
      return;
    }
    const timer = setTimeout(() => setShownGame(true), delayMs);
    return () => clearTimeout(timer);
  }, [inGame, delayMs]);

  if (!enabled || inGame === null) return inGame === true;
  return inGame && shownGame;
}

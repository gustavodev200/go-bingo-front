'use client';

import { useEffect, useRef, useState } from 'react';

export const CELEBRATION_MS = 1200;

/** Ao iniciar a partida no 3D, segura o lobby por um instante (confete) antes de trocar para a tela do jogo. */
export function useCelebrationDelay(inGame: boolean, enabled: boolean, delayMs = CELEBRATION_MS): boolean {
  const [shownGame, setShownGame] = useState(inGame);
  const previous = useRef(inGame);

  useEffect(() => {
    const wasInGame = previous.current;
    previous.current = inGame;
    if (!inGame || wasInGame) {
      setShownGame(inGame);
      return;
    }
    const timer = setTimeout(() => setShownGame(true), delayMs);
    return () => clearTimeout(timer);
  }, [inGame, delayMs]);

  if (!enabled) return inGame;
  return inGame && shownGame;
}

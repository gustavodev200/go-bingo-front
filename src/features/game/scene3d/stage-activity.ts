import { createContext, useContext } from 'react';

/**
 * Diz ao FrameDriver quando a cena tem movimento que merece o FPS "ativo" (sorteio, entrada/saída, dança, câmera,
 * comemoração). Fora disso a cena roda no FPS ocioso — só respiração, piscar e luzes.
 */
export interface StageActivity {
  /** Mantém o FPS ativo por `ms` a partir de agora (chamadas se estendem, nunca encurtam). */
  keepActive(ms: number): void;
  isActive(now: number): boolean;
}

export function createStageActivity(clock: () => number = () => performance.now()): StageActivity {
  let until = 0;
  return {
    keepActive(ms) {
      until = Math.max(until, clock() + ms);
    },
    isActive(now) {
      return now < until;
    },
  };
}

const IDLE: StageActivity = { keepActive: () => undefined, isActive: () => false };

export const StageActivityContext = createContext<StageActivity>(IDLE);

export function useStageActivity(): StageActivity {
  return useContext(StageActivityContext);
}

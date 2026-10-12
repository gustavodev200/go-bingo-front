/** Folga (ms) para o jitter do rAF: sem ela, 60 FPS numa tela de 60 Hz pularia quadros alternados. */
const JITTER_MS = 2;

export interface FramePacer {
  /** `true` quando já é hora de desenhar outro quadro no teto `fps`. Chamar a cada rAF. */
  due(now: number, fps: number): boolean;
  reset(): void;
}

/**
 * Limita a frequência de quadros independentemente da taxa da tela (60/90/120/165 Hz).
 * Mantém a cadência média (ex.: 20 FPS em 60 Hz = a cada 3 vsyncs) e não acumula atraso depois de uma pausa.
 */
export function createFramePacer(): FramePacer {
  let last = -Infinity;
  return {
    due(now, fps) {
      const interval = 1000 / fps;
      if (now - last < interval - JITTER_MS) return false;
      last += interval;
      if (now - last > interval) last = now;
      return true;
    },
    reset() {
      last = -Infinity;
    },
  };
}

export type QualityStep = 'decline' | 'incline';

export interface FrameMonitorOptions {
  /** Janela de observação (ms). */
  windowMs?: number;
  /** Abaixo desta fração do teto (ex.: 0,8 = 48 de 60 FPS) a janela conta como lenta. */
  slowRatio?: number;
  /** Janelas lentas seguidas para baixar a qualidade. */
  slowWindows?: number;
  /** Janelas boas seguidas para subir (uma vez só). */
  goodWindows?: number;
  /** Depois de uma troca, espera o novo DPR assentar antes de voltar a medir. */
  settleMs?: number;
  /** Trocas de direção (desce/sobe) até parar de adaptar — evita ficar oscilando. */
  maxFlips?: number;
}

export interface FrameMonitor {
  /** Registra um quadro realmente desenhado; devolve a troca de qualidade sugerida, se houver. */
  record(now: number, targetFps: number): QualityStep | null;
}

/**
 * Qualidade adaptativa por condição real: compara os quadros entregues com o teto pedido (não com a taxa da tela).
 * Com o teto de FPS, o PerformanceMonitor do drei leria "30 FPS" como aparelho fraco; aqui 30 de 30 é saudável.
 * Também pega o Modo de Pouca Energia do iOS (rAF a 30 Hz): sem entregar 60, desce até o perfil de economia.
 */
export function createFrameMonitor({ windowMs = 1000, slowRatio = 0.8, slowWindows = 2, goodWindows = 5, settleMs = 2000, maxFlips = 3 }: FrameMonitorOptions = {}): FrameMonitor {
  let windowStart: number | null = null;
  let windowFps = 0;
  let frames = 0;
  let lastFrame = 0;
  let slow = 0;
  let good = 0;
  let settleUntil = 0;
  let lastStep: QualityStep | null = null;
  let flips = 0;
  let inclined = false;

  const step = (now: number, next: QualityStep): QualityStep | null => {
    if (lastStep && lastStep !== next) flips += 1;
    lastStep = next;
    slow = 0;
    good = 0;
    windowStart = null;
    settleUntil = now + settleMs;
    if (next === 'incline') inclined = true;
    return next;
  };

  return {
    record(now, targetFps) {
      if (flips >= maxFlips || now < settleUntil) return null;
      // Lacuna (aba oculta, canvas fora da tela) ou troca de teto (ocioso ↔ ativo): recomeça a janela.
      const gap = now - lastFrame > Math.max(250, 4000 / targetFps);
      lastFrame = now;
      if (windowStart === null || gap || targetFps !== windowFps) {
        windowStart = now;
        windowFps = targetFps;
        frames = 0;
        return null;
      }
      frames += 1;
      const span = now - windowStart;
      if (span < windowMs) return null;
      const ratio = (frames * 1000) / span / targetFps;
      windowStart = now;
      frames = 0;
      if (ratio < slowRatio) {
        slow += 1;
        good = 0;
      } else if (ratio >= 0.95) {
        good += 1;
        slow = 0;
      } else {
        slow = 0;
        good = 0;
      }
      if (slow >= slowWindows) return step(now, 'decline');
      if (good >= goodWindows && !inclined) return step(now, 'incline');
      return null;
    },
  };
}

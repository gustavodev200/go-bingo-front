import { SFX_NOTES, type Sfx } from './sfx';

export type AudioCtxLike = Pick<AudioContext, 'currentTime' | 'state' | 'resume' | 'suspend' | 'createOscillator' | 'createGain' | 'destination'>;

/**
 * Sem efeito tocando por este tempo, o AudioContext é suspenso: rodando, ele mantém o áudio do aparelho processando
 * silêncio a partida inteira (bateria). O próximo som retoma sozinho — o gesto do usuário já liberou o áudio.
 */
export const IDLE_SUSPEND_MS = 3000;

export interface SfxPlayer {
  /** Cria/retoma o AudioContext — chamar dentro de um gesto do usuário (exigência do iOS). */
  unlock(): void;
  play(sfx: Sfx): void;
  isRunning(): boolean;
}

/** Sons sintetizados (sem arquivos): um oscilador com envelope por nota. AudioContext criado só no primeiro uso. */
export function createSfxPlayer(factory: () => AudioCtxLike | null, idleMs = IDLE_SUSPEND_MS): SfxPlayer {
  let ctx: AudioCtxLike | null = null;
  let tried = false;
  /** Suspenso por ociosidade (não por autoplay): o áudio já foi liberado, conta como pronto. */
  let idleSuspended = false;
  let idleTimer: ReturnType<typeof setTimeout> | undefined;
  const ensure = () => {
    if (!tried) {
      tried = true;
      ctx = factory();
    }
    // 'suspended' (autoplay ou ociosidade) e 'interrupted' (iOS após ligação/tela travada) precisam de resume.
    if (ctx && ctx.state !== 'running' && ctx.state !== 'closed') {
      const settle = () => void (idleSuspended = false);
      void ctx.resume().then(settle, settle);
    }
    return ctx;
  };
  const suspendWhenIdle = (afterMs: number) => {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      if (ctx?.state !== 'running') return;
      idleSuspended = true;
      void ctx.suspend().catch(() => void (idleSuspended = false));
    }, afterMs + idleMs);
  };
  return {
    unlock: () => {
      if (ensure()) suspendWhenIdle(0);
    },
    isRunning: () => ctx?.state === 'running' || idleSuspended,
    play(sfx) {
      const c = ensure();
      if (!c) return;
      const t0 = c.currentTime;
      let endS = 0;
      for (const n of SFX_NOTES[sfx]) {
        const osc = c.createOscillator();
        const gain = c.createGain();
        const start = t0 + n.at;
        osc.type = n.wave;
        osc.frequency.setValueAtTime(n.freq, start);
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(n.gain, start + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + n.dur);
        osc.connect(gain);
        gain.connect(c.destination);
        osc.start(start);
        osc.stop(start + n.dur + 0.02);
        endS = Math.max(endS, n.at + n.dur + 0.02);
      }
      suspendWhenIdle(endS * 1000);
    },
  };
}

function browserAudio(): AudioCtxLike | null {
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  try {
    return new AC();
  } catch {
    return null;
  }
}

let shared: SfxPlayer | null = null;
export function sharedSfxPlayer(): SfxPlayer {
  shared ??= createSfxPlayer(browserAudio);
  return shared;
}

import { SFX_NOTES, type Sfx } from './sfx';

export type AudioCtxLike = Pick<AudioContext, 'currentTime' | 'state' | 'resume' | 'createOscillator' | 'createGain' | 'destination'>;

export interface SfxPlayer {
  /** Cria/retoma o AudioContext — chamar dentro de um gesto do usuário (exigência do iOS). */
  unlock(): void;
  play(sfx: Sfx): void;
  isRunning(): boolean;
}

/** Sons sintetizados (sem arquivos): um oscilador com envelope por nota. AudioContext criado só no primeiro uso. */
export function createSfxPlayer(factory: () => AudioCtxLike | null): SfxPlayer {
  let ctx: AudioCtxLike | null = null;
  let tried = false;
  const ensure = () => {
    if (!tried) {
      tried = true;
      ctx = factory();
    }
    // 'suspended' (autoplay) e 'interrupted' (iOS após ligação/tela travada) precisam de resume.
    if (ctx && ctx.state !== 'running' && ctx.state !== 'closed') void ctx.resume().catch(() => undefined);
    return ctx;
  };
  return {
    unlock: () => void ensure(),
    isRunning: () => ctx?.state === 'running',
    play(sfx) {
      const c = ensure();
      if (!c) return;
      const t0 = c.currentTime;
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
      }
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

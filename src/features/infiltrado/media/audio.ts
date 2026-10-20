// Tiny WebAudio synth for Infiltrado: effects only, no audio files.
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;

const MUTE_KEY = 'infiltrado.muted';
try {
  muted = typeof localStorage !== 'undefined' && localStorage.getItem(MUTE_KEY) === '1';
} catch {
  /* storage blocked */
}

/** Must run inside a user gesture (iOS). */
export function unlockAudio(): void {
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.45;
    master.connect(ctx.destination);
  }
  if (ctx.state !== 'running') void ctx.resume();
}

export const isMuted = () => muted;

export function toggleMute(): boolean {
  muted = !muted;
  try {
    localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
  } catch {
    /* storage blocked */
  }
  if (master) master.gain.value = muted ? 0 : 0.45;
  return muted;
}

function tone(freq: number, dur: number, { type = 'sine' as OscillatorType, vol = 0.3, at = 0, slide = 0 } = {}) {
  if (!ctx || !master) return;
  const t = ctx.currentTime + at;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

export type Sfx = 'click' | 'task' | 'taskStep' | 'kill' | 'killed' | 'alarm' | 'meeting' | 'vote' | 'eject' | 'siren' | 'fixed' | 'vent' | 'win' | 'lose' | 'reveal' | 'chat';

/** Plays one effect (no-op until the audio is unlocked). */
export function sfx(name: Sfx): void {
  switch (name) {
    case 'click':
      return tone(900, 0.05, { type: 'triangle', vol: 0.15 });
    case 'taskStep':
      return tone(660, 0.07, { type: 'triangle', vol: 0.18 });
    case 'task':
      tone(523, 0.1, { type: 'triangle', vol: 0.25 });
      tone(784, 0.18, { type: 'triangle', vol: 0.25, at: 0.09 });
      return;
    case 'kill':
      tone(140, 0.35, { type: 'sawtooth', vol: 0.3, slide: -90 });
      tone(70, 0.4, { type: 'square', vol: 0.2, at: 0.05 });
      return;
    case 'killed':
      tone(300, 0.6, { type: 'sawtooth', vol: 0.3, slide: -260 });
      tone(90, 0.8, { type: 'sine', vol: 0.35, at: 0.1 });
      return;
    case 'alarm':
      for (let i = 0; i < 4; i++) {
        tone(880, 0.16, { type: 'square', vol: 0.18, at: i * 0.32 });
        tone(660, 0.16, { type: 'square', vol: 0.18, at: i * 0.32 + 0.16 });
      }
      return;
    case 'meeting':
      tone(392, 0.18, { type: 'triangle', vol: 0.3 });
      tone(523, 0.18, { type: 'triangle', vol: 0.3, at: 0.18 });
      tone(659, 0.35, { type: 'triangle', vol: 0.3, at: 0.36 });
      return;
    case 'vote':
      return tone(1200, 0.08, { type: 'square', vol: 0.12 });
    case 'eject':
      return tone(500, 1.4, { type: 'sine', vol: 0.25, slide: -440 });
    case 'siren':
      return tone(700, 0.45, { type: 'sawtooth', vol: 0.12, slide: 300 });
    case 'fixed':
      tone(660, 0.1, { type: 'triangle', vol: 0.2 });
      tone(990, 0.2, { type: 'triangle', vol: 0.2, at: 0.1 });
      return;
    case 'vent':
      return tone(180, 0.18, { type: 'square', vol: 0.15, slide: -60 });
    case 'win':
      [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.25, { type: 'triangle', vol: 0.25, at: i * 0.14 }));
      return;
    case 'lose':
      [392, 330, 262].forEach((f, i) => tone(f, 0.35, { type: 'triangle', vol: 0.25, at: i * 0.22 }));
      return;
    case 'reveal':
      tone(110, 1.2, { type: 'sawtooth', vol: 0.15 });
      tone(165, 1.2, { type: 'sine', vol: 0.2 });
      return;
    case 'chat':
      return tone(1400, 0.05, { type: 'sine', vol: 0.12 });
  }
}

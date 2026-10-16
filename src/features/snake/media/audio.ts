// Tiny synthesized sound effects (no assets).
const MUTE_KEY = 'snake.mute';
let ctx: AudioContext | null = null;
let muted = (() => {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
})();

export function unlockAudio(): void {
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (AC) ctx = new AC();
  }
  if (ctx?.state === 'suspended') void ctx.resume();
}

export const isMuted = () => muted;

export function toggleMute(): boolean {
  muted = !muted;
  try {
    localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
  } catch {
    // private mode: the choice lasts for this page only
  }
  return muted;
}

function tone(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.08, slide = 0) {
  if (!ctx || muted) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(ctx.destination);
  o.start(t);
  o.stop(t + dur);
}

let lastEat = 0;
export type SnakeSfx = 'eat' | 'kill' | 'die' | 'start';

export function sfx(name: SnakeSfx): void {
  switch (name) {
    case 'eat': {
      const now = performance.now();
      if (now - lastEat < 70) return;
      lastEat = now;
      tone(520 + Math.random() * 260, 0.07, 'sine', 0.05, 300);
      return;
    }
    case 'kill':
      tone(330, 0.12, 'square', 0.06, 330);
      setTimeout(() => tone(660, 0.18, 'square', 0.06, 220), 90);
      return;
    case 'die':
      tone(300, 0.5, 'sawtooth', 0.08, -240);
      return;
    case 'start':
      tone(440, 0.1, 'triangle', 0.07, 200);
      setTimeout(() => tone(660, 0.14, 'triangle', 0.07, 200), 100);
  }
}

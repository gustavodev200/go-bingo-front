// Tiny WebAudio synth: chiptune effects and a looping battle theme. No audio files.
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let musicGain: GainNode | null = null;
let muted = false;
let noiseBuf: AudioBuffer | null = null;
let lastBoom = 0;

const MUTE_KEY = 'bomber.muted';
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
    master.gain.value = muted ? 0 : 0.5;
    master.connect(ctx.destination);
    musicGain = ctx.createGain();
    musicGain.gain.value = 0.22;
    musicGain.connect(master);
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
  if (master) master.gain.value = muted ? 0 : 0.5;
  return muted;
}

function tone(freq: number, dur: number, { type = 'square' as OscillatorType, vol = 0.3, at = 0, slide = 0, out = master } = {}) {
  if (!ctx || !out) return;
  const t = ctx.currentTime + at;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(dur: number, { vol = 0.5, at = 0, freq = 1200, sweep = 200 } = {}) {
  if (!ctx || !master) return;
  if (!noiseBuf) {
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const t = ctx.currentTime + at;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.setValueAtTime(freq, t);
  f.frequency.exponentialRampToValueAtTime(sweep, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t);
  src.stop(t + dur);
}

export type BomberSfx = 'place' | 'boom' | 'item' | 'skull' | 'die' | 'kick' | 'throw' | 'pick' | 'land' | 'beep' | 'go' | 'thud' | 'hurry' | 'win' | 'draw' | 'click';

export function sfx(name: BomberSfx): void {
  if (!ctx || muted) return;
  const seq = (notes: number[], step: number, opts: Parameters<typeof tone>[2] = {}) => notes.forEach((f, i) => tone(f, step * 1.2, { ...opts, at: i * step }));
  switch (name) {
    case 'place':
      return tone(220, 0.08, { vol: 0.25, slide: -80 });
    case 'boom':
      if (ctx.currentTime - lastBoom < 0.05) return;
      lastBoom = ctx.currentTime;
      noise(0.7, { vol: 0.9, freq: 2400, sweep: 80 });
      return tone(90, 0.4, { type: 'triangle', vol: 0.5, slide: -60 });
    case 'item':
      return seq([660, 880, 1320], 0.06, { vol: 0.18 });
    case 'skull':
      return seq([400, 300, 200], 0.09, { type: 'sawtooth', vol: 0.15 });
    case 'die':
      return tone(880, 0.7, { vol: 0.2, slide: -800 });
    case 'kick':
      noise(0.12, { vol: 0.5, freq: 600, sweep: 100 });
      return tone(120, 0.1, { vol: 0.3 });
    case 'throw':
      return tone(300, 0.25, { type: 'triangle', vol: 0.3, slide: 500 });
    case 'pick':
      return tone(500, 0.08, { vol: 0.2, slide: 200 });
    case 'land':
      return noise(0.08, { vol: 0.4, freq: 800, sweep: 120 });
    case 'beep':
      return tone(880, 0.12, { vol: 0.25 });
    case 'go':
      tone(1320, 0.3, { vol: 0.25 });
      return tone(1760, 0.3, { vol: 0.15, at: 0.05 });
    case 'thud':
      return noise(0.15, { vol: 0.45, freq: 400, sweep: 60 });
    case 'hurry':
      return seq([988, 784, 988, 784], 0.14, { vol: 0.25 });
    case 'win':
      return seq([523, 659, 784, 1047, 784, 1047], 0.13, { vol: 0.22 });
    case 'draw':
      return seq([392, 349, 330, 262], 0.18, { type: 'triangle', vol: 0.3 });
    case 'click':
      return tone(1000, 0.04, { vol: 0.12 });
  }
}

// ---------- Music ----------
const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);
const LEAD = [72, 0, 72, 74, 76, 0, 72, 0, 79, 0, 77, 76, 74, 0, 0, 0, 71, 0, 71, 72, 74, 0, 71, 0, 77, 0, 76, 74, 72, 0, 0, 0, 72, 0, 72, 74, 76, 0, 79, 0, 81, 0, 79, 77, 76, 0, 74, 0, 77, 76, 74, 72, 71, 0, 74, 0, 72, 0, 0, 0, 67, 0, 0, 0];
const BASS = [48, 48, 55, 55, 48, 48, 55, 55, 53, 53, 60, 60, 55, 55, 50, 50, 43, 43, 50, 50, 43, 43, 50, 50, 53, 53, 48, 48, 43, 43, 47, 47, 48, 48, 55, 55, 48, 48, 55, 55, 53, 53, 60, 60, 57, 57, 53, 53, 50, 50, 57, 57, 43, 43, 47, 47, 48, 48, 43, 43, 48, 48, 48, 0];
let musicTimer: ReturnType<typeof setInterval> | undefined;
let step = 0;
let nextTime = 0;
let tempo = 0.14;

export function startMusic(): void {
  if (!ctx || musicTimer) return;
  const audio = ctx;
  tempo = 0.14;
  step = 0;
  nextTime = audio.currentTime + 0.1;
  musicTimer = setInterval(() => {
    while (nextTime < audio.currentTime + 0.3) {
      if (!muted) {
        const at = nextTime - audio.currentTime;
        const l = LEAD[step % LEAD.length];
        const b = BASS[step % BASS.length];
        if (l) tone(midi(l), tempo * 0.9, { vol: 0.35, at, out: musicGain });
        if (b) tone(midi(b), tempo * 0.95, { type: 'triangle', vol: 0.6, at, out: musicGain });
        if (step % 4 === 2) noise(0.04, { vol: 0.25, at, freq: 6000, sweep: 3000 });
      }
      step++;
      nextTime += tempo;
    }
  }, 50);
}

/** Sudden death speeds the theme up. */
export function setMusicFast(fast: boolean): void {
  tempo = fast ? 0.105 : 0.14;
}

export function stopMusic(): void {
  clearInterval(musicTimer);
  musicTimer = undefined;
}

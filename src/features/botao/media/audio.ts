// Sintetizador mínimo em WebAudio: chute, trave, apito e torcida. Sem arquivos de áudio.
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;
let noiseBuf: AudioBuffer | null = null;

const MUTE_KEY = 'botao.muted';
try {
  muted = typeof localStorage !== 'undefined' && localStorage.getItem(MUTE_KEY) === '1';
} catch {
  /* storage bloqueado */
}

/** Precisa rodar dentro de um gesto do usuário (iOS). */
export function unlockAudio(): void {
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.5;
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
    /* storage bloqueado */
  }
  if (master) master.gain.value = muted ? 0 : 0.5;
  return muted;
}

function tone(freq: number, dur: number, { type = 'sine' as OscillatorType, vol = 0.3, at = 0, slide = 0, vibrato = 0 } = {}) {
  if (!ctx || !master) return;
  const t = ctx.currentTime + at;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
  if (vibrato) {
    const lfo = ctx.createOscillator();
    const depth = ctx.createGain();
    lfo.frequency.value = 28;
    depth.gain.value = vibrato;
    lfo.connect(depth).connect(o.frequency);
    lfo.start(t);
    lfo.stop(t + dur);
  }
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(dur: number, { vol = 0.4, at = 0, freq = 900, sweep = 200, attack = 0.005 } = {}) {
  if (!ctx || !master) return;
  if (!noiseBuf) {
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const t = ctx.currentTime + at;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.setValueAtTime(freq, t);
  f.frequency.exponentialRampToValueAtTime(Math.max(40, sweep), t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t);
  src.stop(t + dur);
}

export type Sfx = 'kick' | 'myKick' | 'post' | 'whistle' | 'end' | 'goal' | 'concede' | 'beep';

export function sfx(name: Sfx): void {
  if (!ctx || muted) return;
  switch (name) {
    case 'kick':
      return noise(0.08, { vol: 0.25, freq: 500, sweep: 120 });
    case 'myKick':
      tone(140, 0.09, { type: 'triangle', vol: 0.45, slide: -80 });
      return noise(0.07, { vol: 0.35, freq: 700, sweep: 150 });
    case 'post':
      tone(1250, 0.35, { type: 'triangle', vol: 0.18 });
      return tone(1870, 0.25, { type: 'sine', vol: 0.1 });
    case 'whistle':
      return tone(2900, 0.32, { vol: 0.16, vibrato: 90 });
    case 'end':
      tone(2900, 0.25, { vol: 0.16, vibrato: 90 });
      tone(2900, 0.25, { vol: 0.16, vibrato: 90, at: 0.32 });
      return tone(2900, 0.7, { vol: 0.16, vibrato: 90, at: 0.64 });
    case 'goal':
      noise(1.8, { vol: 0.35, freq: 1400, sweep: 600, attack: 0.25 });
      tone(523, 0.18, { type: 'square', vol: 0.12 });
      tone(659, 0.18, { type: 'square', vol: 0.12, at: 0.16 });
      return tone(784, 0.4, { type: 'square', vol: 0.12, at: 0.32 });
    case 'concede':
      noise(1.2, { vol: 0.2, freq: 600, sweep: 200, attack: 0.2 });
      return tone(330, 0.5, { type: 'triangle', vol: 0.15, slide: -120 });
    case 'beep':
      return tone(880, 0.12, { type: 'square', vol: 0.12 });
  }
}

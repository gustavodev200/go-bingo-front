'use client';

import type { TacadaSimEvent } from '@/contracts';

/**
 * Billiard sounds synthesized on the fly (no files): a short filtered noise burst per
 * contact, louder for harder hits. One shared noise buffer; at most a few voices per
 * frame so a break never floods the audio thread.
 */
let ctx: AudioContext | null = null;
let noise: AudioBuffer | null = null;
let lastFrameAt = 0;
let voicesThisFrame = 0;
const MAX_VOICES_PER_FRAME = 4;

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.25), ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
  return ctx;
}

/** Call inside a user gesture (iOS needs it before any sound). */
export function unlockPoolSound(): void {
  audio();
}

function burst(freq: number, q: number, gain: number, dur: number, type: BiquadFilterType = 'bandpass') {
  const a = audio();
  if (!a || !noise || a.state !== 'running') return;
  const now = a.currentTime;
  if (now - lastFrameAt > 0.012) {
    lastFrameAt = now;
    voicesThisFrame = 0;
  }
  if (voicesThisFrame++ >= MAX_VOICES_PER_FRAME) return;
  const src = a.createBufferSource();
  src.buffer = noise;
  const filter = a.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = freq;
  filter.Q.value = q;
  const env = a.createGain();
  env.gain.setValueAtTime(gain, now);
  env.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  src.connect(filter).connect(env).connect(a.destination);
  src.start(now, Math.random() * 0.15, dur + 0.02);
}

/** The cue hitting the cue ball. */
export function playStrike(power: number): void {
  burst(1800, 2.5, 0.12 + 0.35 * power, 0.05);
}

/** Sounds for what happened in one simulation step. */
export function playSimEvents(events: readonly TacadaSimEvent[]): void {
  for (const e of events) {
    if (e.kind === 'ball') {
      const v = Math.min(1, e.speed / 260);
      if (v > 0.02) burst(3200 + v * 1400, 6, 0.08 + 0.5 * v, 0.045);
    } else if (e.kind === 'rail') {
      const v = Math.min(1, e.speed / 260);
      if (v > 0.04) burst(380, 1.2, 0.08 + 0.3 * v, 0.09, 'lowpass');
    } else {
      burst(260, 1, 0.45, 0.22, 'lowpass');
      setTimeout(() => burst(900, 3, 0.12, 0.06), 70);
    }
  }
}

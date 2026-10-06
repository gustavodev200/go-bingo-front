export type Sfx = 'draw' | 'one-away' | 'bingo-me' | 'bingo-other' | 'ended';

export interface Note {
  freq: number;
  /** segundos a partir do início do efeito */
  at: number;
  dur: number;
  wave: OscillatorType;
  gain: number;
}

const arpeggio = (freqs: number[], step: number, dur: number, wave: OscillatorType, gain: number): Note[] => freqs.map((freq, i) => ({ freq, at: i * step, dur, wave, gain }));

export const SFX_NOTES: Record<Sfx, Note[]> = {
  draw: [
    { freq: 660, at: 0, dur: 0.08, wave: 'triangle', gain: 0.22 },
    { freq: 990, at: 0.07, dur: 0.14, wave: 'triangle', gain: 0.18 },
  ],
  'one-away': arpeggio([880, 1175, 1568], 0.11, 0.14, 'sine', 0.16),
  'bingo-me': [...arpeggio([523, 659, 784, 1047], 0.12, 0.22, 'square', 0.1), { freq: 1047, at: 0.5, dur: 0.7, wave: 'triangle', gain: 0.18 }],
  'bingo-other': arpeggio([784, 988, 1175], 0.14, 0.3, 'sine', 0.14),
  ended: arpeggio([392, 330, 262], 0.25, 0.35, 'sine', 0.14),
};

export interface SoundState {
  drawnCount: number;
  oneAway: ReadonlySet<string>;
  winnerId: string | null;
  ended: boolean;
}

/** Que sons tocar entre dois estados. Primeiro estado (entrar/recarregar) é sempre silencioso. */
export function sfxFor(prev: SoundState | null, next: SoundState, myUserId: string | null): Sfx[] {
  if (!prev) return [];
  const out: Sfx[] = [];
  if (next.drawnCount > prev.drawnCount) out.push('draw');
  if ([...next.oneAway].some((id) => !prev.oneAway.has(id))) out.push('one-away');
  if (next.winnerId && next.winnerId !== prev.winnerId) out.push(next.winnerId === myUserId ? 'bingo-me' : 'bingo-other');
  if (next.ended && !prev.ended) out.push('ended');
  return out;
}

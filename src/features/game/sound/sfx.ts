export type Sfx = 'draw' | 'one-away' | 'bingo-me' | 'bingo-other' | 'ended' | TrucoSfx | UnoOnlySfx;
/** Truco Mineiro effects share the same synthesizer. */
export type TrucoSfx = 'card' | 'truco' | 'accept' | 'run' | 'hand-won' | 'hand-lost' | 'signal' | 'match-won' | 'match-lost' | 'error';

/** UNO effects: its own plus the shared card/result sounds of the truco. */
type UnoOnlySfx = 'uno-call' | 'uno-draw' | 'uno-skip' | 'uno-wild' | 'uno-turn' | 'uno-caught';
export type UnoSfx = UnoOnlySfx | 'card' | 'run' | 'hand-won' | 'hand-lost' | 'match-won' | 'match-lost' | 'error';

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
  card: [
    { freq: 320, at: 0, dur: 0.05, wave: 'triangle', gain: 0.2 },
    { freq: 220, at: 0.04, dur: 0.06, wave: 'triangle', gain: 0.12 },
  ],
  truco: [...arpeggio([196, 262, 392], 0.07, 0.18, 'sawtooth', 0.12), { freq: 523, at: 0.22, dur: 0.5, wave: 'square', gain: 0.12 }],
  accept: arpeggio([523, 784], 0.1, 0.2, 'triangle', 0.16),
  run: arpeggio([440, 330, 220], 0.09, 0.16, 'sawtooth', 0.08),
  'hand-won': arpeggio([523, 659, 784], 0.1, 0.22, 'triangle', 0.16),
  'hand-lost': arpeggio([330, 262], 0.15, 0.3, 'sine', 0.14),
  signal: [{ freq: 1320, at: 0, dur: 0.12, wave: 'sine', gain: 0.1 }],
  'match-won': [...arpeggio([523, 659, 784, 1047, 1319], 0.12, 0.24, 'square', 0.09), { freq: 1047, at: 0.62, dur: 0.8, wave: 'triangle', gain: 0.18 }],
  'match-lost': arpeggio([392, 349, 311, 262], 0.28, 0.4, 'sine', 0.14),
  error: [{ freq: 160, at: 0, dur: 0.18, wave: 'square', gain: 0.08 }],
  'uno-call': [...arpeggio([659, 880, 1319], 0.06, 0.12, 'square', 0.1), { freq: 1760, at: 0.2, dur: 0.35, wave: 'triangle', gain: 0.16 }],
  'uno-draw': [
    { freq: 520, at: 0, dur: 0.05, wave: 'triangle', gain: 0.14 },
    { freq: 390, at: 0.05, dur: 0.07, wave: 'triangle', gain: 0.1 },
  ],
  'uno-skip': arpeggio([880, 587], 0.08, 0.12, 'sawtooth', 0.08),
  'uno-wild': arpeggio([392, 523, 659, 784, 1047], 0.05, 0.12, 'sine', 0.13),
  'uno-turn': arpeggio([988, 1319], 0.09, 0.12, 'sine', 0.12),
  'uno-caught': [...arpeggio([784, 622, 494], 0.08, 0.14, 'square', 0.09), { freq: 330, at: 0.26, dur: 0.3, wave: 'sawtooth', gain: 0.08 }],
};

export interface SoundState {
  drawnCount: number;
  oneAway: ReadonlySet<string>;
  winnerId: string | null;
  ended: boolean;
}

/** Que sons tocar entre dois estados. Primeiro estado (entrar/recarregar) e ressincronizações são silenciosos. */
export function sfxFor(prev: SoundState | null, next: SoundState, myUserId: string | null): Sfx[] {
  if (!prev) return [];
  // Ressincronização (reconexão) pulando vários números: estado novo de base, sem som.
  if (next.drawnCount > prev.drawnCount + 1) return [];
  const out: Sfx[] = [];
  if (next.drawnCount > prev.drawnCount) out.push('draw');
  if ([...next.oneAway].some((id) => !prev.oneAway.has(id))) out.push('one-away');
  if (next.winnerId && next.winnerId !== prev.winnerId) out.push(next.winnerId === myUserId ? 'bingo-me' : 'bingo-other');
  if (next.ended && !prev.ended) out.push('ended');
  return out;
}

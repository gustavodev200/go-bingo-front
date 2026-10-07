import { letterFor } from '@/contracts';

export interface UtteranceLike {
  text?: string;
  lang: string;
  rate: number;
  voice: SpeechSynthesisVoice | null;
}
export interface SpeechLike {
  speak(utterance: UtteranceLike): void;
  cancel(): void;
  getVoices(): SpeechSynthesisVoice[];
}
export interface Narrator {
  /** false sem Web Speech API: a UI esconde o botão. */
  supported: boolean;
  speak(text: string): void;
}

/** "B, 7": a vírgula dá a pausa entre a letra e o número na voz sintetizada. */
export function ballPhrase(n: number): string {
  return `${letterFor(n)}, ${n}`;
}

function pickVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const norm = (lang: string) => lang.toLowerCase().replace('_', '-');
  return voices.find((v) => norm(v.lang) === 'pt-br') ?? voices.find((v) => norm(v.lang).startsWith('pt')) ?? null;
}

/** Narração por Web Speech API; cada frase corta a anterior (nunca acumula fila se as bolas vierem rápido). */
export function createNarrator({ synth, utter }: { synth: SpeechLike | null; utter: (text: string) => UtteranceLike }): Narrator {
  if (!synth) return { supported: false, speak: () => undefined };
  return {
    supported: true,
    speak(text) {
      try {
        synth.cancel();
        const u = utter(text);
        u.lang = 'pt-BR';
        u.rate = 1.05;
        u.voice = pickVoice(synth.getVoices());
        synth.speak(u);
      } catch {
        // Motor de voz indisponível no momento (ex.: iOS em segundo plano): só não fala.
      }
    },
  };
}

let shared: Narrator | null = null;

export function sharedNarrator(): Narrator {
  if (typeof window === 'undefined') return { supported: false, speak: () => undefined };
  shared ??= createNarrator({
    synth: 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined' ? (window.speechSynthesis as unknown as SpeechLike) : null,
    utter: (text) => new SpeechSynthesisUtterance(text),
  });
  return shared;
}

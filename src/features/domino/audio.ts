'use client';

import type { Narrator } from '@/features/game/sound/narration';
import type { SfxPlayer } from '@/features/game/sound/sfx-player';
import { usePersistedFlag } from '@/features/game/sound/use-persisted-flag';
import type { Reaction } from './reactions';

export interface AudioPrefs {
  voice: boolean;
  sfx: boolean;
}

export interface AudioControls extends AudioPrefs {
  setVoice(v: boolean): void;
  setSfx(v: boolean): void;
}

/** Voice and sound effects are switched independently and remembered on the device (both on by default). */
export function useDominoAudioPrefs(): AudioControls {
  const [voice, setVoice] = usePersistedFlag('domino:voice', true);
  const [sfx, setSfx] = usePersistedFlag('domino:sfx', true);
  return { voice, setVoice, sfx, setSfx };
}

/** Plays the audible part of a reaction according to the preferences. */
export function playReaction(reaction: Reaction, prefs: AudioPrefs, deps: { sfx: SfxPlayer; narrator: Narrator }): void {
  if (prefs.sfx && reaction.sfx) deps.sfx.play(reaction.sfx);
  if (prefs.voice && reaction.speech && deps.narrator.supported) deps.narrator.speak(reaction.speech);
}

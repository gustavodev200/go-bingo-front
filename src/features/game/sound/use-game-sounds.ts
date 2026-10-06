'use client';

import { useEffect } from 'react';
import { useGameStore, type GameStoreState } from '../store';
import { sfxFor, type SoundState } from './sfx';
import { sharedSfxPlayer, type SfxPlayer } from './sfx-player';

function toSoundState(s: GameStoreState): SoundState {
  const remaining = s.snapshot?.game?.remaining ?? {};
  return {
    drawnCount: s.snapshot?.game?.drawn.length ?? 0,
    oneAway: new Set(
      Object.entries(remaining)
        .filter(([, left]) => left === 1)
        .map(([id]) => id),
    ),
    winnerId: s.winner?.userId ?? null,
    ended: s.endedWithoutWinner,
  };
}

/** Toca os efeitos da partida a partir da store (2D e 3D). Mudo = nada toca; primeiro estado é silencioso. */
export function useGameSounds(muted: boolean, player: SfxPlayer = sharedSfxPlayer()) {
  useEffect(() => {
    const unlock = () => player.unlock();
    window.addEventListener('pointerdown', unlock, { once: true });
    return () => window.removeEventListener('pointerdown', unlock);
  }, [player]);

  useEffect(() => {
    let prev: SoundState | null = null;
    const check = () => {
      const state = useGameStore.getState();
      if (!state.snapshot) {
        prev = null;
        return;
      }
      const next = toSoundState(state);
      const effects = sfxFor(prev, next, state.myUserId);
      prev = next;
      if (!muted) effects.forEach((sfx) => player.play(sfx));
    };
    check();
    return useGameStore.subscribe(check);
  }, [muted, player]);
}

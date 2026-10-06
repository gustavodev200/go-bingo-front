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
    // Só gestos que contam como ativação do usuário (no iOS, touch pointerdown não conta).
    const GESTURES = ['pointerup', 'touchend', 'click', 'keydown'] as const;
    const stop = () => GESTURES.forEach((g) => window.removeEventListener(g, unlock));
    function unlock() {
      player.unlock();
      if (player.isRunning()) stop();
    }
    GESTURES.forEach((g) => window.addEventListener(g, unlock));
    return stop;
  }, [player]);

  useEffect(() => {
    let prev: SoundState | null = null;
    const check = () => {
      const state = useGameStore.getState();
      if (!state.snapshot || state.connection === 'reconnecting') {
        // Sem sala ou reconectando: o próximo snapshot vira a nova base (sem som de ressincronização).
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

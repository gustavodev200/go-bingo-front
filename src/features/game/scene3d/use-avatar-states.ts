import { useCallback, useEffect, useRef, useState } from 'react';
import { useGameStore } from '../store';
import { botMembers } from './bots';
import { choreograph, statesChanged, triggerDance } from './choreographer';
import type { AvatarState } from './pose';

export const TICK_MS = 150;
const defaultClock = () => performance.now();

/**
 * Assina a store fora do render, roda o coreógrafo e guarda o resultado num ref (lido a cada frame pelo R3F).
 * `list` só muda quando alguém entra/sai ou troca de fase — nunca a 60 Hz.
 */
export function useAvatarStates(botTotal = 0, clock: () => number = defaultClock) {
  const statesRef = useRef<Map<string, AvatarState>>(new Map());
  const initialized = useRef(false);
  const botsShown = useRef(0);
  const [list, setList] = useState<AvatarState[]>([]);

  const commit = useCallback((next: Map<string, AvatarState>) => {
    const changed = statesChanged(initialized.current ? statesRef.current : null, next);
    statesRef.current = next;
    initialized.current = true;
    if (changed) setList([...next.values()]);
  }, []);

  useEffect(() => {
    const recompute = () => {
      const { snapshot } = useGameStore.getState();
      if (!snapshot) return;
      const bots = botMembers(botsShown.current, snapshot.members.map((m) => m.slot));
      const members = [...snapshot.members, ...bots];
      commit(choreograph(initialized.current ? statesRef.current : null, { members, hostId: snapshot.hostId, now: clock() }));
    };
    recompute();
    const unsubscribe = useGameStore.subscribe(recompute);
    const tick = setInterval(() => {
      if (botsShown.current < botTotal - 1) botsShown.current += 1;
      recompute();
    }, TICK_MS);
    return () => {
      unsubscribe();
      clearInterval(tick);
    };
  }, [botTotal, clock, commit]);

  const dance = useCallback(
    (userId: string) => {
      const myUserId = useGameStore.getState().myUserId;
      if (!myUserId) return;
      commit(triggerDance(statesRef.current, userId, myUserId, clock()));
    },
    [clock, commit],
  );

  return { statesRef, list, dance };
}

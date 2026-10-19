'use client';

import { useContext, useEffect, useRef, useState } from 'react';
import { latestResultResponseSchema, type MatchResultDto } from '@/contracts';
import { ProfileContext } from '@/features/profile/profile-context';
import { apiFetch } from '@/lib/api';

const FIRST_POLL_MS = 400;
const POLL_MS = 800;
const MAX_TRIES = 12;
/** O resultado desta partida nasce no instante em que ela acaba; o da anterior é bem mais velho. */
const FRESH_MS = 20_000;

export type RewardStatus = 'waiting' | 'ready' | 'missing';

/**
 * Recompensa da partida que acabou de terminar. O servidor liquida moedas e pontos logo depois do
 * fim; o painel de resultado monta nesse momento e espera o resultado aparecer. "Novo" é medido
 * pelo relógio do servidor (resposta `now`), não pelo do aparelho.
 */
export function useMatchReward(): { reward: MatchResultDto | null; status: RewardStatus } {
  const profile = useContext(ProfileContext);
  const refreshRef = useRef(profile?.refresh);
  const [state, setState] = useState<{ reward: MatchResultDto | null; status: RewardStatus }>({ reward: null, status: 'waiting' });

  useEffect(() => {
    refreshRef.current = profile?.refresh;
  }, [profile?.refresh]);

  useEffect(() => {
    let active = true;
    let tries = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      try {
        const { result, now } = await apiFetch('/arena/latest', latestResultResponseSchema);
        if (!active) return;
        if (result && Date.parse(result.createdAt) >= Date.parse(now) - FRESH_MS) {
          setState({ reward: result, status: 'ready' });
          void refreshRef.current?.();
          return;
        }
      } catch {
        // tenta de novo
      }
      if (!active) return;
      if (++tries >= MAX_TRIES) setState({ reward: null, status: 'missing' });
      else timer = setTimeout(() => void poll(), POLL_MS);
    };
    timer = setTimeout(() => void poll(), FIRST_POLL_MS);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, []);

  return state;
}

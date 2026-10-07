'use client';

import { useCallback, useEffect, useState } from 'react';
import { profileStatsSchema, type ProfileStats } from '@/contracts';
import { apiFetch } from '@/lib/api';

export interface ProfileStatsState {
  state: 'loading' | 'error' | 'ok';
  stats: ProfileStats | null;
  reload(): void;
}

export function useProfileStats(): ProfileStatsState {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<Omit<ProfileStatsState, 'reload'>>({ state: 'loading', stats: null });

  useEffect(() => {
    let active = true;
    apiFetch('/me/stats', profileStatsSchema).then(
      (stats) => active && setResult({ state: 'ok', stats }),
      () => active && setResult({ state: 'error', stats: null }),
    );
    return () => {
      active = false;
    };
  }, [attempt]);

  const reload = useCallback(() => {
    setResult({ state: 'loading', stats: null });
    setAttempt((n) => n + 1);
  }, []);

  return { ...result, reload };
}

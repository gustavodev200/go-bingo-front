'use client';

import { usePersistedFlag } from './use-persisted-flag';

/** Mudo persistente (PRD US-4.1). */
export function useMuted(): [boolean, (muted: boolean) => void] {
  return usePersistedFlag('go-bingo:muted');
}

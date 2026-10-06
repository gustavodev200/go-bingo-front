'use client';

import { useCallback, useState } from 'react';

const KEY = 'go-bingo:muted';

function readMuted(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

/** Mudo persistente (PRD US-4.1). */
export function useMuted(): [boolean, (muted: boolean) => void] {
  const [muted, setState] = useState(readMuted);
  const setMuted = useCallback((next: boolean) => {
    try {
      localStorage.setItem(KEY, next ? '1' : '0');
    } catch {
      // Armazenamento bloqueado: vale só nesta sessão.
    }
    setState(next);
  }, []);
  return [muted, setMuted];
}

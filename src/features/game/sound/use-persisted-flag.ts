'use client';

import { useCallback, useState } from 'react';

function read(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

/** Liga/desliga lembrado no aparelho (padrão: desligado). Armazenamento bloqueado = vale só nesta sessão. */
export function usePersistedFlag(key: string): [boolean, (value: boolean) => void] {
  const [value, setState] = useState(() => read(key));
  const setValue = useCallback(
    (next: boolean) => {
      try {
        localStorage.setItem(key, next ? '1' : '0');
      } catch {
        // Armazenamento bloqueado: vale só nesta sessão.
      }
      setState(next);
    },
    [key],
  );
  return [value, setValue];
}

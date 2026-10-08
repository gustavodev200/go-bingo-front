'use client';

import { useCallback, useState } from 'react';

function read(key: string, initial: boolean): boolean {
  try {
    const stored = localStorage.getItem(key);
    return stored === null ? initial : stored === '1';
  } catch {
    return initial;
  }
}

/** Liga/desliga lembrado no aparelho (padrão: `initial`, desligado se omitido). Armazenamento bloqueado = vale só nesta sessão. */
export function usePersistedFlag(key: string, initial = false): [boolean, (value: boolean) => void] {
  const [value, setState] = useState(() => read(key, initial));
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

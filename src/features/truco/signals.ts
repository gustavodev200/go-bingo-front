import { TRUCO_GESTURES, type TrucoGesture } from '@/contracts';

export const GESTURES: Record<TrucoGesture, { emoji: string; label: string }> = {
  wink: { emoji: '😉', label: 'Piscada' },
  eyebrow: { emoji: '🤨', label: 'Sobrancelha levantada' },
  pout: { emoji: '😗', label: 'Biquinho' },
  tongue: { emoji: '😛', label: 'Mostrar a língua' },
  nose: { emoji: '👃', label: 'Coçar o nariz' },
  shoulder: { emoji: '🤷', label: 'Levantar o ombro' },
};

/** What a gesture may mean. Conventions, not rules: each pair agrees on its own. */
export const MEANINGS = ['Zap (4 de paus)', 'Copeta (7 de copas)', 'Espadilha (Ás de espadas)', 'Pica-fumo (7 de ouros)', 'Carta alta (3 ou 2)', 'Confiança: pode trucar', 'Mão fraca', 'Estou blefando', 'Sem significado'] as const;
export type Meaning = (typeof MEANINGS)[number];
export type Conventions = Record<TrucoGesture, Meaning>;

export const DEFAULT_CONVENTIONS: Conventions = {
  wink: 'Zap (4 de paus)',
  eyebrow: 'Copeta (7 de copas)',
  pout: 'Espadilha (Ás de espadas)',
  tongue: 'Pica-fumo (7 de ouros)',
  nose: 'Carta alta (3 ou 2)',
  shoulder: 'Confiança: pode trucar',
};

const STORAGE_KEY = 'truco:signals';

/** Conventions live only on this device: the server never knows what a gesture means. */
export function loadConventions(): Conventions {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    if (!raw || typeof raw !== 'object') return { ...DEFAULT_CONVENTIONS };
    const out = { ...DEFAULT_CONVENTIONS };
    for (const g of TRUCO_GESTURES) {
      const value = (raw as Record<string, unknown>)[g];
      if (MEANINGS.includes(value as Meaning)) out[g] = value as Meaning;
    }
    return out;
  } catch {
    return { ...DEFAULT_CONVENTIONS };
  }
}

export function saveConventions(conventions: Conventions): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(conventions));
  } catch {
    // Storage blocked: the change lasts for this session only.
  }
}

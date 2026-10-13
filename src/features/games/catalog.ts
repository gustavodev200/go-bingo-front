import type { ComponentType } from 'react';
import { TrucoArt } from '@/features/truco/truco-art';
import { UnoArt } from '@/features/uno/uno-art';
import { BingoArt } from './bingo-art';

export type GameStatus = 'available' | 'coming-soon';

export interface Game {
  id: string;
  name: string;
  description: string;
  /** Entry route of the game (its lobby). */
  href: string;
  status: GameStatus;
  tags: readonly string[];
  /** Card glow color on hover/focus. */
  glow: string;
  /** Decorative illustration shown at the top of the card. */
  Art: ComponentType;
}

/** Every game on the platform. To add one: create its route and append an entry here. */
export const GAMES: readonly Game[] = [
  {
    id: 'bingo',
    name: 'Bingo',
    description: 'Globo girando, cartela na mão: marque os números e grite BINGO antes da galera.',
    href: '/bingo',
    status: 'available',
    tags: ['Multijogador', 'Salas públicas'],
    glow: '#f59e0b',
    Art: BingoArt,
  },
  {
    id: 'truco',
    name: 'Truco Mineiro',
    description: 'Truco Mineiro 2 contra 2 ao vivo: zap na mão, sinal pro parceiro e grite TRUCO na hora certa.',
    href: '/truco',
    status: 'available',
    tags: ['4 jogadores', 'Duplas', 'Tempo real'],
    glow: '#22c55e',
    Art: TrucoArt,
  },
  {
    id: 'uno',
    name: 'UNO',
    description: 'De 2 a 6 na mesa: +4 na hora certa, desafie o blefe e não esqueça de gritar UNO!',
    href: '/uno',
    status: 'available',
    tags: ['2 a 6 jogadores', 'Salas públicas', 'Tempo real'],
    glow: '#ef4444',
    Art: UnoArt,
  },
];

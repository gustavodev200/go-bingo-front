import { GAUD_CALL_LABEL, type GaudCall, type GaudRoomState, type GaudRoundView, type GaudSeat, type GaudSettings } from '@/contracts';

/** Onde cada lugar aparece na tela: eu sempre embaixo, a vez gira para a minha direita. */
export type TablePosition = 'bottom' | 'right' | 'top' | 'left';
const FOUR: TablePosition[] = ['bottom', 'right', 'top', 'left'];

export function positionOf(seat: GaudSeat, mySeat: GaudSeat, size: number): TablePosition {
  if (size === 2) return seat === mySeat ? 'bottom' : 'top';
  return FOUR[(seat - mySeat + 4) % 4];
}

/** Os lugares em jogo, menos o meu, na ordem em que jogam depois de mim. */
export function otherSeats(mySeat: GaudSeat, size: number): GaudSeat[] {
  return Array.from({ length: size - 1 }, (_, i) => ((mySeat + i + 1) % size) as GaudSeat);
}

export const settingsLabel = (s: GaudSettings) => `${s.size === 2 ? 'Mano a mano' : 'Duplas'} · até ${s.target}${s.flor ? ' · com flor' : ' · sem flor'}`;

/** A rodada no meio da mesa: a atual, ou a última fechada enquanto a próxima está vazia. */
export function visibleRound(state: GaudRoomState | null): { round: GaudRoundView; number: number } | null {
  const rounds = state?.match?.rounds;
  if (!rounds?.length) return null;
  const current = rounds[rounds.length - 1];
  if (current.plays.length === 0 && rounds.length > 1) return { round: rounds[rounds.length - 2], number: rounds.length - 1 };
  return { round: current, number: rounds.length };
}

/** Rótulo do botão de um canto ("Truco!", "Quero retruco!"...). */
export const callButtonLabel = (call: GaudCall) => `${GAUD_CALL_LABEL[call]}!`;

/** Nome do valor atual da mão no truco. */
export const TRUCO_VALUE_NAME: Record<number, string> = { 1: 'Mão simples', 2: 'Truco', 3: 'Retruco', 4: 'Vale 4' };

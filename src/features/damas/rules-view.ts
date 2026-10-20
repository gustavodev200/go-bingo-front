import { DAMAS_DRAW_MOVES, type DamasEndReason, type DamasMatchResult, type DamasRoomState } from '@/contracts';

export const turnLabel = (seconds: number) => (seconds >= 60 ? `${seconds / 60} min` : `${seconds} s`);

/** Why the match ended, from the point of view of whoever reads it. */
export function endReasonText(reason: DamasEndReason, iWon: boolean): string {
  switch (reason) {
    case 'no_pieces':
      return iWon ? 'Você capturou todas as peças.' : 'Todas as suas peças foram capturadas.';
    case 'blocked':
      return iWon ? 'O adversário ficou sem lances.' : 'Suas peças ficaram sem lances.';
    case 'resign':
      return iWon ? 'O adversário desistiu.' : 'Você desistiu.';
    case 'timeout':
      return iWon ? 'O tempo do adversário estourou 3 vezes seguidas.' : 'Seu tempo estourou 3 vezes seguidas.';
    case 'abandoned':
      return iWon ? 'O adversário saiu da mesa.' : 'Você saiu da partida.';
    case 'draw_agreed':
      return 'Empate combinado entre os dois.';
    case 'draw_moves':
      return `${DAMAS_DRAW_MOVES} lances de cada lado só com damas, sem captura.`;
  }
}

/** "Você venceu!", "Bia venceu!" or "Empate!". */
export function winnerTitle(state: DamasRoomState, result: DamasMatchResult, mySeat: number): string {
  if (result.winner === null) return 'Empate!';
  return result.winner === mySeat ? 'Você venceu!' : `${state.seats[result.winner]?.nickname ?? 'Alguém'} venceu!`;
}

/** Moves left before the king-only draw, shown once it gets close (null = not close). */
export function drawCountdown(quietMoves: number): number | null {
  const left = 2 * DAMAS_DRAW_MOVES - quietMoves;
  return quietMoves >= DAMAS_DRAW_MOVES ? Math.ceil(left / 2) : null;
}

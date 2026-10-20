import type { TacadaEndReason, TacadaFoul, TacadaGroup, TacadaMatchResult, TacadaRoomState } from '@/contracts';

export const shotLabel = (seconds: number) => `${seconds} s`;

export const GROUP_LABEL: Record<TacadaGroup, string> = { solids: 'Lisas', stripes: 'Listradas' };

export const POCKET_NAMES = ['canto de cima à esquerda', 'meio de cima', 'canto de cima à direita', 'canto de baixo à esquerda', 'meio de baixo', 'canto de baixo à direita'];

/** Short reason of a foul, as shown in the banner. */
export function foulText(foul: TacadaFoul): string {
  switch (foul) {
    case 'scratch':
      return 'a branca caiu';
    case 'no_hit':
      return 'a branca não tocou em nada';
    case 'wrong_first':
      return 'tocou primeiro na bola errada';
    case 'no_rail':
      return 'nenhuma bola foi na tabela';
    case 'timeout':
      return 'o tempo acabou';
  }
}

/** Why the match ended, from the point of view of whoever reads it. */
export function endReasonText(reason: TacadaEndReason, iWon: boolean): string {
  switch (reason) {
    case 'eight':
      return iWon ? 'Você limpou o grupo e matou a 8 na caçapa cantada.' : 'O adversário limpou o grupo e matou a 8 na caçapa cantada.';
    case 'eight_early':
      return iWon ? 'O adversário encaçapou a 8 antes da hora.' : 'Você encaçapou a 8 antes de limpar o seu grupo.';
    case 'eight_foul':
      return iWon ? 'O adversário encaçapou a 8 cometendo falta.' : 'A 8 caiu junto com uma falta.';
    case 'eight_wrong_pocket':
      return iWon ? 'A 8 do adversário caiu na caçapa errada.' : 'A 8 caiu em outra caçapa, não na cantada.';
    case 'fouls':
      return iWon ? 'O adversário fez 3 faltas seguidas.' : 'Você fez 3 faltas seguidas.';
    case 'resign':
      return iWon ? 'O adversário desistiu.' : 'Você desistiu.';
    case 'abandoned':
      return iWon ? 'O adversário saiu da mesa.' : 'Você saiu da partida.';
  }
}

/** "Você venceu!" or "Bia venceu!". */
export function winnerTitle(state: TacadaRoomState, result: TacadaMatchResult, mySeat: number): string {
  return result.winner === mySeat ? 'Você venceu!' : `${state.seats[result.winner]?.nickname ?? 'Alguém'} venceu!`;
}

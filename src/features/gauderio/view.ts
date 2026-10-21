import {
  GAUD_CALL_LABEL,
  type GaudCall,
  type GaudFinish,
  type GaudRoomState,
  type GaudRoundView,
  type GaudSeat,
  type GaudSettings,
  type GaudSideResult,
  type GaudTeam,
  type GaudVote,
} from '@/contracts';

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

/** Rótulo de um voto ("Quero", "Não quero", "Retruco!"). */
export const voteLabel = (vote: GaudVote) => (vote === 'accept' ? 'Quero' : vote === 'decline' ? 'Não quero' : callButtonLabel(vote));

const sideName = (kind: GaudSideResult['kind']) => (kind === 'flor' ? 'Flor' : 'Envido');

/**
 * Como saiu um envido/flor, do ponto de vista de quem vê:
 * título ("Flor de Bia!"), explicação e se foi bom para nós.
 */
export function describeSide(result: GaudSideResult, myTeam: GaudTeam, nameOf: (seat: GaudSeat) => string): { title: string; detail: string; ours: boolean } {
  const ours = result.winnerTeam === myTeam;
  const side = ours ? 'nós' : 'eles';
  const who = nameOf(result.seat);
  const last = GAUD_CALL_LABEL[result.chain[result.chain.length - 1] ?? 'envido'];
  if (result.outcome === 'uncontested') return { title: `🌸 Flor de ${who}!`, detail: `Três cartas do mesmo naipe e ninguém do outro lado tinha flor · +${result.points} para ${side}`, ours };
  if (result.outcome === 'declined')
    return { title: `${sideName(result.kind)}: não quiseram`, detail: `${ours ? 'Eles fugiram' : 'Fugimos'} do ${last} de ${who} · +${result.points} para ${side}`, ours };
  const loserTeam = (1 - result.winnerTeam) as GaudTeam;
  const winPts = result.teamPoints[result.winnerTeam];
  const losePts = result.teamPoints[loserTeam];
  const loserSeat = result.bestSeats[loserTeam];
  const against = loserSeat !== null && losePts !== null ? ` contra ${losePts} de ${nameOf(loserSeat)}` : '';
  const tie = winPts === losePts ? ' (empate: ganha quem é mão)' : '';
  return {
    title: `${result.kind === 'flor' ? '🌸 ' : ''}${sideName(result.kind)} de ${who}: ${winPts}!`,
    detail: `${winPts}${against}${tie} · ${result.chain.map((c) => GAUD_CALL_LABEL[c]).join(' → ')} · +${result.points} para ${side}`,
    ours,
  };
}

/** Como a partida foi fechada ("com a flor de Bia (+3)"). */
export function finishText(finish: GaudFinish | null, nameOf: (seat: GaudSeat) => string): string | null {
  if (!finish) return null;
  const side = finish.side;
  switch (finish.by) {
    case 'flor':
      return side?.outcome === 'declined' ? `Fecharam porque fugiram da flor (+${finish.points})` : `Fecharam com a flor de ${side ? nameOf(side.seat) : '?'} (+${finish.points})`;
    case 'envido':
      return side?.outcome === 'declined' ? `Fecharam porque fugiram do envido (+${finish.points})` : `Fecharam no envido de ${side ? nameOf(side.seat) : '?'} (+${finish.points})`;
    case 'declined':
      return `Fecharam porque não quiseram o truco (+${finish.points})`;
    case 'folded':
      return `Fecharam porque foram ao baralho (+${finish.points})`;
    default:
      return `Fecharam ganhando a mão (+${finish.points})`;
  }
}

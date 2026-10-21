import type { GaudSideResult } from '@/contracts';
import { describeSide, finishText, voteLabel } from './view';

const names = ['Ana', 'Bia', 'Caio', 'Duda'];
const nameOf = (seat: number) => names[seat];
const side = (over: Partial<GaudSideResult>): GaudSideResult => ({
  kind: 'envido',
  winnerTeam: 0,
  points: 2,
  seat: 0,
  chain: ['envido'],
  accepted: true,
  outcome: 'compared',
  teamPoints: [28, 25],
  bestSeats: [0, 1],
  ...over,
});

describe('describeSide', () => {
  it('flor sem flor do outro lado', () => {
    expect(describeSide(side({ kind: 'flor', outcome: 'uncontested', accepted: false, seat: 2, points: 3, chain: ['flor'] }), 0, nameOf)).toEqual({
      title: '🌸 Flor de Caio!',
      detail: 'Três cartas do mesmo naipe e ninguém do outro lado tinha flor · +3 para nós',
      ours: true,
    });
  });

  it('fuga e comparação com empate', () => {
    expect(describeSide(side({ outcome: 'declined', accepted: false, seat: 1, winnerTeam: 1, chain: ['envido', 'real_envido'], points: 2 }), 0, nameOf).detail).toBe(
      'Fugimos do Real Envido de Bia · +2 para eles',
    );
    expect(describeSide(side({ outcome: 'declined', accepted: false, seat: 0, chain: ['envido'], points: 1 }), 0, nameOf).detail).toBe('Eles fugiram do Envido de Ana · +1 para nós');
    expect(describeSide(side({ teamPoints: [30, 30] }), 1, nameOf).detail).toBe('30 contra 30 de Bia (empate: ganha quem é mão) · Envido · +2 para eles');
  });
});

describe('finishText', () => {
  it('diz como a partida foi fechada', () => {
    expect(finishText(null, nameOf)).toBeNull();
    expect(finishText({ by: 'flor', points: 4, side: side({ kind: 'flor', outcome: 'declined' }) }, nameOf)).toBe('Fecharam porque fugiram da flor (+4)');
    expect(finishText({ by: 'envido', points: 2, side: side({}) }, nameOf)).toBe('Fecharam no envido de Ana (+2)');
    expect(finishText({ by: 'envido', points: 1, side: side({ outcome: 'declined' }) }, nameOf)).toBe('Fecharam porque fugiram do envido (+1)');
    expect(finishText({ by: 'declined', points: 2, side: null }, nameOf)).toBe('Fecharam porque não quiseram o truco (+2)');
    expect(finishText({ by: 'folded', points: 1, side: null }, nameOf)).toBe('Fecharam porque foram ao baralho (+1)');
    expect(finishText({ by: 'rounds', points: 3, side: null }, nameOf)).toBe('Fecharam ganhando a mão (+3)');
  });

  it('rótulos de voto', () => {
    expect([voteLabel('accept'), voteLabel('decline'), voteLabel('vale4')]).toEqual(['Quero', 'Não quero', 'Vale 4!']);
  });
});

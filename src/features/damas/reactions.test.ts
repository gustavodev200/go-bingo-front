import { reactionFor } from './reactions';

const nameOf = (seat: number) => ['Ana', 'Bia'][seat];

describe('reactionFor', () => {
  it('celebrates a promotion and multi-captures', () => {
    expect(reactionFor({ event: 'damas:moved', payload: { seq: 1, seat: 0, from: 9, path: [0], captures: [], promoted: true } }, 0, nameOf)).toMatchObject({ shout: { text: 'DAMA!', tone: 'good' } });
    expect(reactionFor({ event: 'damas:moved', payload: { seq: 2, seat: 1, from: 9, path: [27, 45], captures: [18, 36], promoted: false } }, 0, nameOf)).toMatchObject({
      shout: { text: '2 PEÇAS!', tone: 'bad' },
    });
    expect(reactionFor({ event: 'damas:moved', payload: { seq: 3, seat: 1, from: 9, path: [16], captures: [], promoted: false } }, 0, nameOf)).toEqual({ sfx: 'domino-clack' });
  });

  it('announces draw offers and the end of the match', () => {
    expect(reactionFor({ event: 'damas:draw_offered', payload: { seq: 1, seat: 1 } }, 0, nameOf).banner?.text).toBe('Bia propõe empate');
    expect(reactionFor({ event: 'damas:match_over', payload: { seq: 2, winner: 0, reason: 'no_pieces' } }, 0, nameOf).shout?.text).toBe('VITÓRIA!');
    expect(reactionFor({ event: 'damas:match_over', payload: { seq: 3, winner: null, reason: 'draw_agreed' } }, 0, nameOf).shout?.text).toBe('EMPATE');
  });

  it('tells each player their colour at the start', () => {
    expect(reactionFor({ event: 'damas:match_started', payload: { seq: 1, whiteSeat: 1 } }, 0, nameOf).banner?.text).toBe('Você joga de pretas');
  });
});

import { reactionFor, type Announced } from './reactions';

const names = ['Ana', 'Bia', 'Caio', 'Duda'];
const nameOf = (s: number) => names[s];
const react = (msg: Announced, mySeat = 0, team: number[] = [mySeat]) => reactionFor(msg, mySeat, nameOf, (seats) => seats.some((s) => team.includes(s)));

describe('domino reactions', () => {
  it('clacks on every tile and shouts the carroça de sena', () => {
    expect(react({ event: 'domino:tile_played', payload: { seq: 1, seat: 1, tile: { a: 2, b: 3 }, side: 'left', tilesLeft: 5 } })).toEqual({ sfx: 'domino-clack' });
    expect(react({ event: 'domino:tile_played', payload: { seq: 1, seat: 1, tile: { a: 6, b: 6 }, side: 'right', tilesLeft: 6 } }).shout?.text).toBe('CARROÇA!');
    expect(react({ event: 'domino:tile_played', payload: { seq: 1, seat: 2, tile: { a: 1, b: 3 }, side: 'right', tilesLeft: 1 } }).banner?.text).toBe('Caio está com 1 peça!');
  });

  it('tells who bought and who passed', () => {
    expect(react({ event: 'domino:tiles_drawn', payload: { seq: 1, seat: 0, count: 3 } }).banner).toEqual({ text: 'Você comprou 3', tone: 'bad' });
    expect(react({ event: 'domino:tiles_drawn', payload: { seq: 1, seat: 1, count: 0 } })).toEqual({});
    expect(react({ event: 'domino:turn_passed', payload: { seq: 1, seat: 1 } }).banner?.text).toBe('Bia passou');
    expect(react({ event: 'domino:turn_passed', payload: { seq: 1, seat: 0 } }).sfx).toBe('domino-pass');
  });

  it('celebrates my side winning a round, in teams too', () => {
    const won: Announced = { event: 'domino:round_ended', payload: { seq: 1, winners: [0, 2], points: 30, blocked: false, pips: [0, 10, 5, 20], scores: [30, 0, 30, 0] } };
    expect(react(won).shout?.text).toBe('BATEU! +30');
    expect(react(won, 2, [0, 2]).shout?.text).toBe('BATEU! +30');
    expect(react(won, 1, [1, 3]).banner?.text).toBe('Ana bateu! +30');
    expect(react({ event: 'domino:round_ended', payload: { seq: 2, winners: [], points: 0, blocked: true, pips: [5, 5, 0, 0], scores: [0, 0, 0, 0] } }).shout?.text).toBe('EMPATE!');
    expect(react({ event: 'domino:round_ended', payload: { seq: 3, winners: [1], points: 12, blocked: true, pips: [12, 3, 0, 0], scores: [0, 12, 0, 0] } }).banner?.text).toBe(
      'Bia ganhou no trancado! +12',
    );
  });

  it('ends the match with a victory or a defeat', () => {
    expect(react({ event: 'domino:match_over', payload: { seq: 1, winners: [0], reason: 'points', scores: [50, 0, 0, 0] } }).sfx).toBe('match-won');
    expect(react({ event: 'domino:match_over', payload: { seq: 1, winners: [1], reason: 'points', scores: [0, 50, 0, 0] } }).sfx).toBe('match-lost');
    expect(react({ event: 'domino:round_started', payload: { seq: 1, roundNumber: 2, starter: 1 } }).banner?.text).toBe('Rodada 2 · Bia sai');
  });
});

import { privateHand, roomState, roundView, seatPlayer } from '@/test/domino-fixtures';
import { autoSide, availableActions, opponentsOf, rulesLabel, sideOf, tileLabel } from './rules-view';

describe('domino rules view', () => {
  it('names tiles and rules in Portuguese', () => {
    expect(tileLabel({ a: 6, b: 6 })).toBe('Carroça de sena');
    expect(tileLabel({ a: 5, b: 2 })).toBe('2 e 5');
    expect(rulesLabel({ target: 50, teams: true })).toBe('Até 50 pontos · Duplas');
  });

  it('seats the next player on my right (anti-clockwise) and the partner across', () => {
    const four = roomState({ seats: [0, 1, 2, 3].map((s) => seatPlayer(s)) });
    expect(opponentsOf(four, 1)).toEqual([
      { seat: 2, spot: 'right' },
      { seat: 3, spot: 'top' },
      { seat: 0, spot: 'left' },
    ]);
    expect(opponentsOf(roomState(), 0).map((o) => o.spot)).toEqual(['right', 'left']);
    expect(opponentsOf(roomState({ seats: [seatPlayer(0), null, seatPlayer(2), null] }), 2)).toEqual([{ seat: 0, spot: 'top' }]);
  });

  it('offers moves only on my turn', () => {
    const mine = availableActions(roomState(), privateHand(), 0);
    expect(mine.myTurn).toBe(true);
    expect([...mine.playable.keys()]).toEqual(['r1t0', 'r1t1']);
    expect(availableActions(roomState({ round: roundView({ turn: 1 }) }), privateHand(), 0).myTurn).toBe(false);
    expect(availableActions(roomState({ round: roundView({ phase: 'ROUND_OVER' }) }), privateHand(), 0).playable.size).toBe(0);
    expect(availableActions(roomState(), privateHand({ playable: [], mustDraw: true }), 0).mustDraw).toBe(true);
  });

  it('asks for an end only when the tile fits two different numbers', () => {
    expect(autoSide(['right'], [1, 3])).toBe('right');
    expect(autoSide(['left', 'right'], [3, 3])).toBeUndefined();
    expect(autoSide(['left', 'right'], [1, 3])).toBeNull();
  });

  it('groups partners in 2 against 2', () => {
    const four = roomState({ rules: { target: 0, teams: true }, seats: [0, 1, 2, 3].map((s) => seatPlayer(s)) });
    expect(sideOf(four, 1)).toEqual([1, 3]);
    expect(sideOf(roomState(), 1)).toEqual([1]);
  });
});

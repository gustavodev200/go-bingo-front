import { privateHand, roomState, roundView, seatPlayer } from '@/test/uno-fixtures';
import { availableActions, cardLabel, opponentsOf, placementOf } from './rules-view';

describe('opponentsOf', () => {
  it('lists the other seated players in play order, starting after me', () => {
    const state = roomState({
      seats: [seatPlayer(0), null, seatPlayer(2), seatPlayer(3), null, seatPlayer(5)],
    });
    expect(opponentsOf(state, 2)).toEqual([3, 5, 0]);
  });
});

describe('placementOf', () => {
  it('puts a single opponent at the top', () => {
    expect(placementOf(0, 1)).toEqual({ left: 50, top: 6 });
  });
  it('spreads 2 to 5 opponents from left to right over an arc, inside the table', () => {
    for (let n = 2; n <= 5; n++) {
      const spots = Array.from({ length: n }, (_, i) => placementOf(i, n));
      expect(spots[0].left).toBeLessThan(spots[n - 1].left);
      for (const s of spots) {
        expect(s.left).toBeGreaterThanOrEqual(0);
        expect(s.left).toBeLessThanOrEqual(100);
        expect(s.top).toBeGreaterThanOrEqual(0);
        expect(s.top).toBeLessThanOrEqual(60);
      }
    }
  });
});

describe('availableActions', () => {
  it('lets the turn player play, draw and nothing else', () => {
    const a = availableActions(roomState(), privateHand(), 0);
    expect(a.myTurn).toBe(true);
    expect(a.canDraw).toBe(true);
    expect(a.canPass).toBe(false);
    expect([...a.playable]).toEqual(['r1c0', 'r1c2']);
    expect(availableActions(roomState(), privateHand(), 1).myTurn).toBe(false);
  });

  it('offers pass after drawing a playable card', () => {
    const state = roomState({ round: roundView({ awaitingDrawn: true }) });
    const a = availableActions(state, privateHand({ drawnCardId: 'r1c0', playable: ['r1c0'] }), 0);
    expect(a.canPass).toBe(true);
    expect(a.canDraw).toBe(false);
  });

  it('offers the +4 challenge to the victim', () => {
    const state = roomState({
      round: roundView({ pendingDraw: 4, canChallenge: true }),
    });
    const a = availableActions(state, privateHand({ playable: [] }), 0);
    expect(a.canChallenge).toBe(true);
    expect(a.pendingDraw).toBe(4);
  });

  it('offers UNO with two cards on my turn, or one card not yet called', () => {
    const two = privateHand({
      cards: privateHand().cards.slice(0, 2),
      playable: ['r1c0'],
    });
    expect(availableActions(roomState(), two, 0).canCallUno).toBe(true);
    expect(availableActions(roomState(), two, 1).canCallUno).toBe(false);
    const one = privateHand({
      cards: privateHand().cards.slice(0, 1),
      playable: [],
    });
    expect(availableActions(roomState(), one, 1).canCallUno).toBe(true);
    const said = roomState({
      round: roundView({ saidUno: [false, true, false, false, false, false] }),
    });
    expect(availableActions(said, one, 1).canCallUno).toBe(false);
  });

  it('offers to catch an exposed opponent, never myself', () => {
    const state = roomState({ round: roundView({ unoExposed: 2 }) });
    expect(availableActions(state, privateHand(), 0).canCatch).toBe(true);
    expect(availableActions(state, privateHand(), 2).canCatch).toBe(false);
  });

  it('allows nothing outside a running round', () => {
    const a = availableActions(roomState({ phase: 'FINISHED' }), privateHand(), 0);
    expect(a.myTurn).toBe(false);
    expect(a.canCallUno).toBe(false);
  });
});

describe('cardLabel', () => {
  it('names cards in Portuguese', () => {
    expect(cardLabel({ color: 'red', value: '5' })).toBe('5 vermelho');
    expect(cardLabel({ color: 'blue', value: 'skip' })).toBe('Pular azul');
    expect(cardLabel({ color: 'green', value: 'draw2' })).toBe('+2 verde');
    expect(cardLabel({ color: 'wild', value: 'wild4' })).toBe('Coringa +4');
  });
});

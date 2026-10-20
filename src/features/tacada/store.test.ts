import { roomState, seatPlayer } from '@/test/tacada-fixtures';
import { reactionFor, type ReactionContext } from './reactions';
import { endReasonText, foulText, shotLabel, winnerTitle } from './rules-view';
import { useTacadaStore } from './store';

const shotPayload = {
  seq: 5,
  shot: { seat: 0, dirX: 1, dirY: 0, power: 1, spinX: 0, spinY: 0, start: [] },
  result: { seat: 0, number: 1, pocketed: [], foul: null, eightRespotted: false, keepsTurn: false },
};

describe('useTacadaStore', () => {
  beforeEach(() => useTacadaStore.getState().reset());

  it('keeps the newest state and finds my seat by user id', () => {
    const s = useTacadaStore.getState();
    s.applySnapshot({ state: roomState({ version: 3 }), mySeat: 1 });
    s.applyState(roomState({ version: 2, phase: 'LOBBY' }));
    expect(useTacadaStore.getState().state?.phase).toBe('PLAYING');
    s.applyState(roomState({ version: 4, seats: [seatPlayer(1, { seat: 0 }), null] }));
    expect(useTacadaStore.getState().mySeat).toBe(0);
  });

  it('queues shots, marks the table as rolling and lets the canvas take them', () => {
    const s = useTacadaStore.getState();
    s.queueShot(shotPayload);
    expect(useTacadaStore.getState()).toMatchObject({ animating: true, shots: [{ id: 5 }] });
    useTacadaStore.getState().takeShot(5);
    useTacadaStore.getState().setAnimating(false);
    expect(useTacadaStore.getState()).toMatchObject({ animating: false, shots: [] });
  });

  it('drops repeated announcements and caps the effects', () => {
    const s = useTacadaStore.getState();
    expect(s.accept(1)).toBe(true);
    expect(useTacadaStore.getState().accept(1)).toBe(false);
    for (let i = 0; i < 10; i++) useTacadaStore.getState().addEffect({ kind: 'banner', text: `${i}`, tone: 'info' });
    expect(useTacadaStore.getState().effects.length).toBeLessThanOrEqual(6);
  });
});

describe('rules view', () => {
  it('labels times, winners, fouls and reasons', () => {
    expect(shotLabel(30)).toBe('30 s');
    expect(winnerTitle(roomState(), { winner: 0, reason: 'eight' }, 0)).toBe('Você venceu!');
    expect(winnerTitle(roomState(), { winner: 1, reason: 'eight' }, 0)).toBe('Bia venceu!');
    for (const reason of ['eight', 'eight_early', 'eight_foul', 'eight_wrong_pocket', 'fouls', 'resign', 'abandoned'] as const) {
      expect(endReasonText(reason, true)).toBeTruthy();
      expect(endReasonText(reason, false)).toBeTruthy();
    }
    for (const foul of ['scratch', 'no_hit', 'wrong_first', 'no_rail', 'timeout'] as const) expect(foulText(foul)).toBeTruthy();
  });
});

describe('reactions', () => {
  const ctx = (over: Partial<ReactionContext> = {}): ReactionContext => ({ mySeat: 0, nameOf: (s) => ['Ana', 'Bia'][s], groups: [null, null], groupsBefore: [null, null], ...over });

  it('announces a foul with the ball in hand for the other player', () => {
    const r = reactionFor({ event: 'tacada:shot', payload: { ...shotPayload, result: { ...shotPayload.result, foul: 'scratch' } } }, ctx());
    expect(r.banner).toEqual({ text: 'Falta: a branca caiu! Bola na mão para Bia', tone: 'bad' });
  });

  it('tells who got which group when the table closes', () => {
    const r = reactionFor({ event: 'tacada:shot', payload: { ...shotPayload, result: { ...shotPayload.result, pocketed: [3], keepsTurn: true } } }, ctx({ groups: ['solids', 'stripes'] }));
    expect(r.banner?.text).toBe('Você fica com as lisas');
  });

  it('shouts a combo for two or more of your balls in one shot', () => {
    const r = reactionFor(
      { event: 'tacada:shot', payload: { ...shotPayload, result: { ...shotPayload.result, pocketed: [3, 5], keepsTurn: true } } },
      ctx({ groups: ['solids', 'stripes'], groupsBefore: ['solids', 'stripes'] }),
    );
    expect(r.shout?.text).toBe('COMBO x2!');
  });

  it('celebrates the win', () => {
    expect(reactionFor({ event: 'tacada:match_over', payload: { seq: 9, winner: 0, reason: 'eight' } }, ctx()).shout?.text).toBe('VITÓRIA!');
  });
});

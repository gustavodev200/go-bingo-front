import { roomState, seatPlayer, playerView, hand } from '@/test/blackjack-fixtures';
import { clampBet, endReasonText, rulesSummary, stackOf, totalLabel } from './rules-view';
import { useBjStore } from './store';
import { reactionFor } from './reactions';

describe('useBjStore', () => {
  beforeEach(() => useBjStore.getState().reset());

  it('keeps the newest state and finds my seat by user id', () => {
    const s = useBjStore.getState();
    s.applySnapshot({ state: roomState({ version: 3 }), mySeat: 1 });
    s.applyState(roomState({ version: 2, phase: 'LOBBY' }));
    expect(useBjStore.getState().state?.phase).toBe('PLAYING');
    s.applyState(roomState({ version: 4, seats: [seatPlayer(1, { seat: 0 }), null, null, null, null] }));
    expect(useBjStore.getState().mySeat).toBe(0);
  });

  it('drops repeated announcements and caps the effects', () => {
    const s = useBjStore.getState();
    expect(s.accept(1)).toBe(true);
    expect(useBjStore.getState().accept(1)).toBe(false);
    for (let i = 0; i < 10; i++) useBjStore.getState().addEffect({ kind: 'banner', text: `${i}`, tone: 'info' });
    expect(useBjStore.getState().effects.length).toBeLessThanOrEqual(6);
  });
});

describe('rules view', () => {
  it('labels totals the way the table says them', () => {
    expect(totalLabel(hand({ cards: ['AS', '6H'], total: 17, soft: true }))).toBe('7/17');
    expect(totalLabel(hand({ cards: ['AS', 'KH'], total: 21, soft: true, status: 'blackjack' }))).toBe('BJ');
    expect(totalLabel(hand({ total: 16 }))).toBe('16');
    expect(rulesSummary({ rounds: 5, payout: '6:5', decks: 2, turnSeconds: 15 })).toBe('5 rodadas · paga 6:5 · 2 baralhos');
    for (const reason of ['rounds', 'broke', 'abandoned'] as const) expect(endReasonText(reason)).toBeTruthy();
  });

  it('clamps bets to the step, the table limit and the stack', () => {
    expect(clampBet(155, 1000)).toBe(160);
    expect(clampBet(900, 1000)).toBe(500);
    expect(clampBet(300, 245)).toBe(240);
    expect(clampBet(0, 1000)).toBe(10);
  });

  it('counts what is on the table as part of the stack', () => {
    expect(stackOf(playerView(0, { chips: 700, hands: [hand({ bet: 200 }), hand({ bet: 100 })], insurance: 50 }))).toBe(1050);
    expect(stackOf(playerView(0, { chips: 900, hands: [], bet: 100 }))).toBe(1000);
  });
});

describe('reactionFor', () => {
  const nameOf = (seat: number) => ['Ana', 'Bia'][seat];

  it('shouts my blackjack and offers insurance', () => {
    expect(reactionFor({ event: 'blackjack:dealt', payload: { seq: 1, insurance: false, blackjacks: [0] } }, 0, nameOf)).toMatchObject({ shout: { text: 'BLACKJACK!' } });
    expect(reactionFor({ event: 'blackjack:dealt', payload: { seq: 2, insurance: true, blackjacks: [] } }, 0, nameOf).banner?.text).toMatch(/seguro/);
    expect(reactionFor({ event: 'blackjack:dealt', payload: { seq: 3, insurance: false, blackjacks: [1] } }, 0, nameOf).banner?.text).toBe('Blackjack de Bia!');
  });

  it('reacts to busts, doubles and the dealer', () => {
    const acted = (seat: number, action: 'hit' | 'double' | 'split' | 'surrender' | 'stand', status: 'bust' | 'doubled' | 'playing' | 'surrendered' | 'stood', auto = false) =>
      reactionFor({ event: 'blackjack:acted', payload: { seq: 1, seat, hand: 0, action, status, total: 24, auto } }, 0, nameOf);
    expect(acted(0, 'hit', 'bust').shout?.text).toBe('ESTOUROU!');
    expect(acted(1, 'hit', 'bust').banner?.text).toBe('Bia estourou com 24');
    expect(acted(1, 'double', 'doubled').banner?.text).toBe('Bia dobrou');
    expect(acted(0, 'split', 'playing').banner?.text).toBe('Mão dividida em duas');
    expect(acted(0, 'surrender', 'surrendered').banner?.text).toMatch(/rendeu/);
    expect(acted(0, 'stand', 'stood', true).banner?.text).toMatch(/tempo acabou/);
    expect(reactionFor({ event: 'blackjack:dealer_played', payload: { seq: 1, total: 23, blackjack: false, bust: true, drew: 1 } }, 0, nameOf).shout?.text).toBe('DEALER ESTOUROU!');
    expect(reactionFor({ event: 'blackjack:dealer_played', payload: { seq: 1, total: 21, blackjack: true, bust: false, drew: 0 } }, 0, nameOf).shout?.text).toBe('BLACKJACK DO DEALER');
  });

  it('tells me how the round and the match went', () => {
    const settled = (net: number) => reactionFor({ event: 'blackjack:round_settled', payload: { seq: 1, round: 1, nets: [{ seat: 0, net }] } }, 0, nameOf).banner?.text;
    expect(settled(150)).toBe('+150 fichas');
    expect(settled(-100)).toBe('−100 fichas');
    expect(settled(0)).toMatch(/Empate/);
    const standings = [
      { seat: 0, userId: 'a', nickname: 'Ana', chips: 1200, placement: 1, left: false },
      { seat: 1, userId: 'b', nickname: 'Bia', chips: 900, placement: 2, left: false },
    ];
    expect(reactionFor({ event: 'blackjack:match_over', payload: { seq: 9, reason: 'rounds', standings } }, 0, nameOf).shout?.text).toBe('VITÓRIA!');
    expect(reactionFor({ event: 'blackjack:match_over', payload: { seq: 9, reason: 'rounds', standings } }, 1, nameOf).shout?.text).toBe('FIM DE JOGO');
    expect(reactionFor({ event: 'blackjack:match_over', payload: { seq: 9, reason: 'rounds', standings: [standings[0]] } }, 0, nameOf).shout?.text).toBe('FIM DO TREINO');
    expect(reactionFor({ event: 'blackjack:round_started', payload: { seq: 2, round: 3 } }, 0, nameOf).banner?.text).toBe('Rodada 3: façam suas apostas');
  });
});

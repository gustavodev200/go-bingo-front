import { reactionFor } from './reactions';
import { useGaudStore } from './store';
import { roomState } from '@/test/gauderio-fixtures';

describe('reactionFor', () => {
  it('grita os cantos e fala só os dos adversários', () => {
    const theirs = reactionFor({ event: 'gauderio:called', payload: { seq: 1, seat: 1, team: 1, call: 'real_envido' } }, 0);
    expect(theirs).toMatchObject({ shout: { text: 'REAL ENVIDO!', tone: 'bet' }, speech: 'Real envido!' });
    const mine = reactionFor({ event: 'gauderio:called', payload: { seq: 2, seat: 0, team: 0, call: 'truco' } }, 0);
    expect(mine.speech).toBeUndefined();
  });

  it('manda o envido/flor para a placa explicativa', () => {
    const payload = { seq: 1, kind: 'flor', winnerTeam: 1, seat: 1, chain: ['flor'], points: 3, accepted: false, outcome: 'uncontested', teamPoints: [null, null], bestSeats: [null, null] } as const;
    const r = reactionFor({ event: 'gauderio:side_resolved', payload: { ...payload, chain: ['flor'], teamPoints: [null, null], bestSeats: [null, null] } }, 1);
    expect(r.side).toMatchObject({ kind: 'flor', seat: 1 });
    expect(r.speech).toBe('Flor! Essa é nossa!');
  });

  it('avisa quando o parceiro votou', () => {
    expect(reactionFor({ event: 'gauderio:voted', payload: { seq: 1, seat: 2, team: 0 } }, 0).banner?.text).toBe('Seu parceiro votou');
    expect(reactionFor({ event: 'gauderio:voted', payload: { seq: 1, seat: 1, team: 1 } }, 0)).toEqual({});
  });

  it('reage às rodadas, mãos, respostas e fim de partida', () => {
    expect(reactionFor({ event: 'gauderio:round_ended', payload: { seq: 1, round: 1, result: 'tie', winningSeat: 0 } }, 0).banner?.text).toMatch(/parda/);
    expect(reactionFor({ event: 'gauderio:round_ended', payload: { seq: 1, round: 2, result: 0, winningSeat: 0 } }, 0).banner?.tone).toBe('good');
    expect(reactionFor({ event: 'gauderio:hand_ended', payload: { seq: 1, winnerTeam: 1, points: 3, reason: 'rounds' } }, 0).shout?.text).toBe('ELES +3');
    expect(reactionFor({ event: 'gauderio:responded', payload: { seq: 1, seat: 1, accept: false, call: 'truco' } }, 0).shout?.text).toBe('NÃO QUERO!');
    expect(reactionFor({ event: 'gauderio:responded', payload: { seq: 1, seat: 1, accept: true, call: 'truco' } }, 0).sfx).toBe('accept');
    expect(reactionFor({ event: 'gauderio:folded', payload: { seq: 1, seat: 1, team: 1 } }, 0).banner?.text).toBe('Foram ao baralho!');
    expect(reactionFor({ event: 'gauderio:card_played', payload: { seq: 1, seat: 0, card: { rank: 1, suit: 'espadas' }, hidden: false, round: 1 } }, 0).shout?.text).toBe('ESPADÃO!');
    expect(reactionFor({ event: 'gauderio:card_played', payload: { seq: 1, seat: 0, card: null, hidden: true, round: 2 } }, 0).sfx).toBe('card');
    expect(reactionFor({ event: 'gauderio:match_over', payload: { seq: 1, winnerTeam: 0, reason: 'points', scores: [12, 3], finish: null } }, 0).shout?.text).toBe('VITÓRIA!');
    expect(reactionFor({ event: 'gauderio:match_over', payload: { seq: 1, winnerTeam: 1, reason: 'points', scores: [3, 12], finish: null } }, 0).shout?.text).toBe('DERROTA');
    expect(reactionFor({ event: 'gauderio:player_reconnected', payload: { seq: 1, seat: 1 } }, 0)).toEqual({});
  });
});

describe('useGaudStore', () => {
  beforeEach(() => useGaudStore.getState().reset());

  it('ignora estados velhos, seq repetido e mãos antigas', () => {
    const s = useGaudStore.getState();
    s.applySnapshot({ state: roomState({ version: 5 }), mySeat: 0, hand: null });
    s.applyState(roomState({ version: 4, scores: [9, 9] }));
    expect(useGaudStore.getState().state?.scores).toEqual([0, 0]);
    s.applyState(roomState({ version: 6, phase: 'LOBBY' }));
    expect(useGaudStore.getState().hand).toBeNull();
    expect(s.accept(1)).toBe(true);
    expect(s.accept(1)).toBe(false);
    const id = s.addEffect({ kind: 'shout', text: 'TRUCO!', tone: 'bet' });
    expect(useGaudStore.getState().effects).toHaveLength(1);
    s.removeEffect(id);
    expect(useGaudStore.getState().effects).toHaveLength(0);
    s.addChat({ seat: 1, to: 'table', text: 'Vem que tem!', bot: true });
    expect(useGaudStore.getState().chat).toHaveLength(1);
    expect(useGaudStore.getState().effects[0]).toMatchObject({ kind: 'say', seat: 1 });
  });
});

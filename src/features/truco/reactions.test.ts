import { reactionFor } from './reactions';

describe('reactionFor', () => {
  it('shouts TRUCO and asks "corre ou aceita" only to the team that must answer', () => {
    const msg = { event: 'truco:bet_requested', payload: { seq: 3, seat: 1, team: 1, value: 3 } } as const;
    expect(reactionFor(msg, 0)).toEqual({ shout: { text: 'TRUCO!', tone: 'bet' }, sfx: 'truco', speech: 'TRUUUCO! Corre ou aceita!' });
    expect(reactionFor(msg, 3).speech).toBe('TRUUUCO!');
    expect(reactionFor({ event: 'truco:bet_requested', payload: { seq: 4, seat: 0, team: 0, value: 9 } }, 0)).toMatchObject({ shout: { text: 'NOVE!' }, speech: 'Vale nove!' });
  });

  it('reacts to answers, special hands and the Zap', () => {
    expect(reactionFor({ event: 'truco:bet_resolved', payload: { seq: 1, seat: 1, response: 'accept', value: 4 } }, 0).shout!.text).toBe('ACEITO!');
    expect(reactionFor({ event: 'truco:bet_resolved', payload: { seq: 1, seat: 1, response: 'run', value: 2 } }, 0).sfx).toBe('run');
    expect(reactionFor({ event: 'truco:hand_dealt', payload: { seq: 1, handNumber: 9, kind: 'iron', tenTeam: null } }, 0).speech).toBe('Mão de ferro!');
    expect(reactionFor({ event: 'truco:hand_dealt', payload: { seq: 1, handNumber: 9, kind: 'ten', tenTeam: 0 } }, 0).shout!.text).toBe('MÃO DE DEZ!');
    expect(reactionFor({ event: 'truco:hand_dealt', payload: { seq: 1, handNumber: 9, kind: 'ten', tenTeam: 0 } }, 0, 'goiano')).toMatchObject({ shout: { text: 'MÃO DE 14!' }, speech: 'Mão de 14!' });
    expect(reactionFor({ event: 'truco:hand_dealt', payload: { seq: 1, handNumber: 2, kind: 'normal', tenTeam: null } }, 0)).toEqual({ sfx: 'card' });
    const zap = { event: 'truco:card_played', payload: { seq: 1, seat: 2, card: { rank: '4', suit: 'clubs' }, round: 1 } } as const;
    expect(reactionFor(zap, 0).speech).toBe('É ZAP, meu parceiro!');
    expect(reactionFor(zap, 1)).toMatchObject({ shout: { text: 'ZAP!', tone: 'bad' }, speech: undefined });
    expect(reactionFor({ event: 'truco:card_played', payload: { seq: 1, seat: 2, card: { rank: '5', suit: 'clubs' }, round: 1 } }, 0)).toEqual({ sfx: 'card' });
    expect(reactionFor({ event: 'truco:ten_decided', payload: { seq: 1, seat: 0, play: true } }, 1).shout!.tone).toBe('bet');
    expect(reactionFor({ event: 'truco:ten_decided', payload: { seq: 1, seat: 0, play: false } }, 1).sfx).toBe('run');
  });

  it('tells every player whether their team won, lost or tied the round', () => {
    const round = (result: 0 | 1 | 'tie', n = 1) => ({ event: 'truco:round_ended', payload: { seq: 1, round: n, result, winningSeat: 0 } }) as const;
    expect(reactionFor(round(0), 2)).toEqual({ banner: { text: 'Vocês ganharam a 1ª rodada', tone: 'good' } });
    expect(reactionFor(round(0), 1)).toEqual({ banner: { text: 'Vocês perderam a 1ª rodada', tone: 'bad' } });
    expect(reactionFor(round('tie', 2), 1).banner!.text).toBe('2ª rodada empatou');
  });

  it('celebrates from my point of view', () => {
    expect(reactionFor({ event: 'truco:hand_ended', payload: { seq: 1, winnerTeam: 1, points: 4, reason: 'rounds' } }, 3)).toMatchObject({ shout: { text: 'NÓS +4', tone: 'good' }, speech: 'Essa mão é nossa!' });
    expect(reactionFor({ event: 'truco:hand_ended', payload: { seq: 1, winnerTeam: 1, points: 2, reason: 'rounds' } }, 0)).toMatchObject({ shout: { text: 'ELES +2' }, sfx: 'hand-lost' });
    expect(reactionFor({ event: 'truco:hand_ended', payload: { seq: 1, winnerTeam: null, points: 0, reason: 'void' } }, 0).shout!.text).toBe('EMPATOU!');
    expect(reactionFor({ event: 'truco:match_over', payload: { seq: 1, winnerTeam: 0, reason: 'points', scores: [12, 4] } }, 2).sfx).toBe('match-won');
    expect(reactionFor({ event: 'truco:match_over', payload: { seq: 1, winnerTeam: 0, reason: 'points', scores: [12, 4] } }, 1).sfx).toBe('match-lost');
    expect(reactionFor({ event: 'truco:match_started', payload: { seq: 1 } }, 1).shout!.text).toBe('BOA SORTE!');
    expect(reactionFor({ event: 'truco:player_reconnected', payload: { seq: 1, seat: 1 } }, 1)).toEqual({});
  });
});

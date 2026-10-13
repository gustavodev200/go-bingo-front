import { reactionFor } from './reactions';

const name = (seat: number) => ['Ana', 'Bia', 'Caio'][seat];

describe('reactionFor', () => {
  it('shouts UNO! with sound and voice', () => {
    const r = reactionFor({ event: 'uno:uno_called', payload: { seq: 1, seat: 1 } }, 0, name);
    expect(r.shout).toEqual({ text: 'UNO!', tone: 'bet' });
    expect(r.sfx).toBe('uno-call');
    expect(r.speech).toBe('UNO!');
  });

  it('tells who got caught, good or bad depending on who', () => {
    expect(reactionFor({ event: 'uno:uno_caught', payload: { seq: 1, seat: 0, by: 1 } }, 0, name).shout).toEqual({ text: 'PEGO!', tone: 'bad' });
    expect(reactionFor({ event: 'uno:uno_caught', payload: { seq: 1, seat: 1, by: 0 } }, 0, name).shout).toEqual({ text: 'PEGOU!', tone: 'good' });
  });

  it('makes a +4 loud', () => {
    const r = reactionFor(
      {
        event: 'uno:card_played',
        payload: {
          seq: 1,
          seat: 1,
          card: { color: 'wild', value: 'wild4' },
          color: 'blue',
          cardsLeft: 3,
        },
      },
      0,
      name,
    );
    expect(r.shout?.text).toBe('+4!');
    expect(r.sfx).toBe('uno-wild');
  });

  it('warns me when I am skipped or penalized', () => {
    expect(reactionFor({ event: 'uno:turn_skipped', payload: { seq: 1, seat: 0 } }, 0, name).banner).toEqual({ text: 'Você perdeu a vez!', tone: 'bad' });
    expect(
      reactionFor(
        {
          event: 'uno:cards_drawn',
          payload: { seq: 1, seat: 0, count: 4, reason: 'penalty' },
        },
        0,
        name,
      ).banner,
    ).toEqual({ text: 'Você comprou 4', tone: 'bad' });
    expect(
      reactionFor(
        {
          event: 'uno:cards_drawn',
          payload: { seq: 1, seat: 1, count: 1, reason: 'choice' },
        },
        0,
        name,
      ).banner,
    ).toBeUndefined();
  });

  it('resolves challenges', () => {
    expect(
      reactionFor(
        {
          event: 'uno:challenge_resolved',
          payload: { seq: 1, challenger: 1, target: 0, bluffed: true },
        },
        2,
        name,
      ).shout?.text,
    ).toBe('BLEFE!');
    expect(
      reactionFor(
        {
          event: 'uno:challenge_resolved',
          payload: { seq: 1, challenger: 1, target: 0, bluffed: false },
        },
        2,
        name,
      ).shout?.text,
    ).toBe('LIMPO!');
  });

  it('celebrates the round and the match from my side', () => {
    expect(
      reactionFor(
        {
          event: 'uno:round_ended',
          payload: {
            seq: 1,
            winner: 0,
            points: 40,
            scores: [40, 0, 0, 0, 0, 0],
          },
        },
        0,
        name,
      ).shout,
    ).toEqual({ text: 'BATEU! +40', tone: 'good' });
    expect(
      reactionFor(
        {
          event: 'uno:round_ended',
          payload: {
            seq: 1,
            winner: 1,
            points: 40,
            scores: [0, 40, 0, 0, 0, 0],
          },
        },
        0,
        name,
      ).banner,
    ).toEqual({ text: 'Bia bateu! +40', tone: 'bad' });
    expect(
      reactionFor(
        {
          event: 'uno:match_over',
          payload: { seq: 1, winner: 0, reason: 'points', scores: [] },
        },
        0,
        name,
      ).sfx,
    ).toBe('match-won');
    expect(
      reactionFor(
        {
          event: 'uno:match_over',
          payload: { seq: 1, winner: 1, reason: 'points', scores: [] },
        },
        0,
        name,
      ).sfx,
    ).toBe('match-lost');
  });
});

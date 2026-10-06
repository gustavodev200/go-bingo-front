import { newlyOneAway } from './one-away';

describe('newlyOneAway', () => {
  it('returns players that just reached 1', () => {
    expect(newlyOneAway({ a: 2, b: 1, c: 3 }, { a: 1, b: 1, c: 2 })).toEqual(['a']);
  });

  it('treats unknown previous values as not one-away', () => {
    expect(newlyOneAway({}, { a: 1 })).toEqual(['a']);
  });
});

import { bubbleFrame, latestPerUser } from './emote-bubble';

describe('latestPerUser', () => {
  it('keeps only the newest reaction of each player, oldest first', () => {
    const r = [
      { id: 1, userId: 'a', emote: 'clap' as const },
      { id: 2, userId: 'b', emote: 'wow' as const },
      { id: 3, userId: 'a', emote: 'fire' as const },
    ];
    expect(latestPerUser(r)).toEqual([r[1], r[2]]);
  });
});

describe('bubbleFrame', () => {
  it('pops in, floats up, fades out and disappears', () => {
    expect(bubbleFrame(0)).toMatchObject({ visible: true, scale: 0, opacity: 1 });
    const mid = bubbleFrame(0.5);
    expect(mid).toMatchObject({ visible: true, scale: 1, opacity: 1 });
    expect(mid.rise).toBeGreaterThan(bubbleFrame(0.1).rise);
    expect(bubbleFrame(0.9).opacity).toBeCloseTo(0.5);
    expect(bubbleFrame(1).visible).toBe(false);
    expect(bubbleFrame(-1).visible).toBe(false);
  });
});

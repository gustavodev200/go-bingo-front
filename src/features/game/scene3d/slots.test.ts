import { DOOR, MAX_SLOTS, slotPosition } from './slots';

const all = Array.from({ length: MAX_SLOTS }, (_, i) => slotPosition(i));
const dist = (a: readonly number[], b: readonly number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);

describe('slotPosition', () => {
  it('gives 25 distinct places at least 0.9 apart on the floor plane', () => {
    for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) expect(dist(all[i], all[j])).toBeGreaterThanOrEqual(0.9);
  });

  it('fills the front row first, centered (host in the middle)', () => {
    expect(slotPosition(0)[0]).toBeCloseTo(0);
    expect(slotPosition(0)[2]).toBeGreaterThan(slotPosition(9)[2]);
    expect(Math.abs(slotPosition(1)[0])).toBeLessThan(Math.abs(slotPosition(8)[0]));
  });

  it('raises back rows like bleachers', () => {
    expect(slotPosition(24)[1]).toBeGreaterThan(slotPosition(0)[1]);
  });

  it('wraps out-of-range slots instead of returning undefined', () => {
    expect(slotPosition(25)).toEqual(slotPosition(0));
    expect(slotPosition(-1)).toEqual(slotPosition(24));
  });

  it('keeps the door outside the crowd, to the left', () => {
    expect(DOOR[0]).toBeLessThan(Math.min(...all.map((p) => p[0])) - 1);
  });
});

import { CONFETTI_COLORS, bulbLevel, confettiParticle } from './ambience';

describe('bulbLevel', () => {
  it('stays within [0.35, 1] and differs between neighbours (a chasing wave)', () => {
    for (let i = 0; i < 30; i++) {
      for (const t of [0, 90, 1000, 123456]) {
        const v = bulbLevel(i, t);
        expect(v).toBeGreaterThanOrEqual(0.35);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
    expect(bulbLevel(0, 500)).not.toBeCloseTo(bulbLevel(3, 500));
  });
});

describe('confettiParticle', () => {
  it('is deterministic and stays inside the hall', () => {
    expect(confettiParticle(5, 1234)).toEqual(confettiParticle(5, 1234));
    for (let i = 0; i < 300; i++) {
      for (const t of [0, 800, 5000]) {
        const p = confettiParticle(i, t);
        expect(p.position[1]).toBeGreaterThanOrEqual(0);
        expect(p.position[1]).toBeLessThanOrEqual(7);
        expect(Math.abs(p.position[0])).toBeLessThanOrEqual(6.5);
        expect(p.colorIndex).toBeGreaterThanOrEqual(0);
        expect(p.colorIndex).toBeLessThan(CONFETTI_COLORS.length);
      }
    }
  });

  it('moves over time', () => {
    expect(confettiParticle(1, 100).position).not.toEqual(confettiParticle(1, 600).position);
  });
});

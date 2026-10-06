import { BALL_FLIGHT_MS, BALL_REST, BALL_SHOW_MS, GLOBE_CENTER, ballFlight, globeSpin, innerBall } from './globe';

describe('ballFlight', () => {
  it('pops out of the globe, lands in front of the stage and disappears after the show time', () => {
    const start = ballFlight(0);
    start.position.forEach((v, i) => expect(v).toBeCloseTo(GLOBE_CENTER[i]));
    expect(start.scale).toBeLessThan(0.05);
    const landed = ballFlight(BALL_FLIGHT_MS * 0.7);
    landed.position.forEach((v, i) => expect(v).toBeCloseTo(BALL_REST[i], 1));
    expect(landed.scale).toBeCloseTo(1);
    expect(ballFlight(BALL_SHOW_MS).visible).toBe(false);
    expect(ballFlight(BALL_SHOW_MS - 1).visible).toBe(true);
  });

  it('finishes well within the 5 s draw interval (animation ≤ interval − 1 s)', () => {
    expect(BALL_SHOW_MS).toBeLessThanOrEqual(4000);
  });

  it('never returns NaN', () => {
    for (const t of [-10, 0, 100, 800, 1600, 3000, 99999]) {
      const f = ballFlight(t);
      [...f.position, f.scale].forEach((v) => expect(Number.isFinite(v)).toBe(true));
    }
  });
});

describe('globeSpin', () => {
  it('idles slowly and bursts right after a draw, decaying back', () => {
    const idle = globeSpin(10_000, 0);
    const burst = globeSpin(1_000, 1_000);
    const later = globeSpin(4_000, 1_000);
    expect(burst).toBeGreaterThan(idle * 5);
    expect(later).toBeLessThan(burst);
    expect(later).toBeCloseTo(idle, 1);
  });
});

describe('innerBall', () => {
  it('stays inside the cage', () => {
    for (let i = 0; i < 20; i++) for (const t of [0, 500, 7777]) expect(Math.hypot(...innerBall(i, t))).toBeLessThanOrEqual(0.55);
  });
});

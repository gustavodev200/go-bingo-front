import { createFrameMonitor, createFramePacer, type QualityStep } from './frame-pacing';

/** Simula rAF numa tela de `hz` por `ms`, contando os quadros liberados no teto `fps`. */
function framesDrawn(hz: number, fps: number, ms = 10_000) {
  const pacer = createFramePacer();
  const vsync = 1000 / hz;
  let drawn = 0;
  for (let now = 0; now < ms; now += vsync) if (pacer.due(now, fps)) drawn += 1;
  return (drawn * 1000) / ms;
}

describe('createFramePacer', () => {
  it('caps rendering at the requested FPS regardless of the display refresh rate', () => {
    expect(framesDrawn(60, 60)).toBeCloseTo(60, 0);
    expect(framesDrawn(120, 60)).toBeCloseTo(60, 0);
    expect(framesDrawn(165, 60)).toBeGreaterThan(54);
    expect(framesDrawn(165, 60)).toBeLessThanOrEqual(61);
    expect(framesDrawn(120, 30)).toBeCloseTo(30, 0);
  });

  it('keeps the average cadence when the cap does not divide the refresh rate', () => {
    expect(framesDrawn(60, 20)).toBeCloseTo(20, 0);
    expect(framesDrawn(90, 60)).toBeGreaterThan(55);
    expect(framesDrawn(90, 60)).toBeLessThanOrEqual(61);
  });

  it('never exceeds the display rate (60 FPS on a 30 Hz low-power rAF draws every vsync)', () => {
    expect(framesDrawn(30, 60)).toBeCloseTo(30, 0);
  });

  it('does not burst to catch up after a pause', () => {
    const pacer = createFramePacer();
    expect(pacer.due(0, 30)).toBe(true);
    expect(pacer.due(5_000, 30)).toBe(true);
    expect(pacer.due(5_016, 30)).toBe(false);
    expect(pacer.due(5_034, 30)).toBe(true);
  });
});

/** Alimenta o monitor com quadros entregues a `deliveredFps` (teto `targetFps`) e devolve as trocas sugeridas. */
function run(monitor: ReturnType<typeof createFrameMonitor>, deliveredFps: number, targetFps: number, fromMs: number, toMs: number) {
  const steps: { at: number; step: QualityStep }[] = [];
  for (let now = fromMs; now < toMs; now += 1000 / deliveredFps) {
    const step = monitor.record(now, targetFps);
    if (step) steps.push({ at: now, step });
  }
  return steps;
}

describe('createFrameMonitor', () => {
  it('does not treat a capped 30 FPS as a slow device', () => {
    expect(run(createFrameMonitor(), 30, 30, 0, 20_000).filter((s) => s.step === 'decline')).toEqual([]);
  });

  it('declines only after sustained slowness (two slow windows), then waits to settle', () => {
    const steps = run(createFrameMonitor(), 40, 60, 0, 6_000);
    expect(steps[0]).toMatchObject({ step: 'decline' });
    expect(steps[0].at).toBeGreaterThanOrEqual(2_000);
    // Espera 2 s para o novo DPR assentar: no máximo uma troca a cada ~4 s.
    expect(steps.length).toBeLessThanOrEqual(2);
  });

  it('a single hitch does not change quality', () => {
    const monitor = createFrameMonitor();
    const steps = [...run(monitor, 60, 60, 0, 3_000), ...run(monitor, 20, 60, 3_000, 3_400), ...run(monitor, 60, 60, 3_400, 6_000)];
    expect(steps.filter((s) => s.step === 'decline')).toEqual([]);
  });

  it('inclines at most once when the device keeps up', () => {
    const steps = run(createFrameMonitor(), 60, 60, 0, 30_000);
    expect(steps.map((s) => s.step)).toEqual(['incline']);
  });

  it('restarts the window after a pause (hidden tab / off-screen) instead of counting it as slow', () => {
    const monitor = createFrameMonitor();
    const steps = [...run(monitor, 60, 60, 0, 1_500), ...run(monitor, 60, 60, 60_000, 61_500)];
    expect(steps.filter((s) => s.step === 'decline')).toEqual([]);
  });

  it('stops adapting after repeated flip-flops', () => {
    const monitor = createFrameMonitor({ goodWindows: 1, maxFlips: 1 });
    run(monitor, 60, 60, 0, 1_100); // sobe
    const later = run(monitor, 30, 60, 5_000, 60_000);
    expect(later.map((s) => s.step)).toEqual(['decline']);
  });
});

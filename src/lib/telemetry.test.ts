import * as Sentry from '@sentry/nextjs';
import { describe, expect, it, vi } from 'vitest';
import { createSessionTelemetry, percentile, reportSessionSummary } from './telemetry';

vi.mock('@sentry/nextjs', () => ({ captureMessage: vi.fn() }));

describe('percentile', () => {
  it('devolve null sem amostras e o valor do rank (nearest-rank) com amostras', () => {
    expect(percentile([], 50)).toBeNull();
    expect(percentile([10, 20, 30, 40, 50], 50)).toBe(30);
    expect(percentile([100, 200, 300, 400, 500, 600, 700, 800, 900, 1000], 95)).toBe(1000);
  });
});

describe('createSessionTelemetry', () => {
  it('resume FPS (p50 a partir dos deltas), latência p95, contexto perdido e modo', () => {
    const report = vi.fn();
    const t = createSessionTelemetry(report);
    t.setMode('3d', null);
    [16, 16, 33, 16, 40].forEach((ms) => t.addFrameDeltaMs(ms));
    [120, 150, 200].forEach((ms) => t.addDrawLatencyMs(ms));
    t.addContextLoss();
    t.flush();
    expect(report).toHaveBeenCalledWith({ mode: '3d', fallbackReason: null, contextLosses: 1, fpsP50: Math.round(1000 / 16), drawLatencyP95Ms: 200, draws: 3 });
  });

  it('flush é idempotente e não reporta sessão sem medição', () => {
    const report = vi.fn();
    const t = createSessionTelemetry(report);
    t.flush();
    expect(report).not.toHaveBeenCalled();
    t.setMode('2d', 'no-webgl2');
    t.addDrawLatencyMs(50);
    t.flush();
    t.flush();
    expect(report).toHaveBeenCalledTimes(1);
  });

  it('sem frames o FPS é null; latência negativa e amostras além do teto são descartadas', () => {
    const report = vi.fn();
    const t = createSessionTelemetry(report);
    t.addDrawLatencyMs(-5);
    for (let i = 0; i < 250; i += 1) t.addDrawLatencyMs(10);
    for (let i = 0; i < 5_100; i += 1) t.addFrameDeltaMs(20);
    t.flush();
    expect(report).toHaveBeenCalledWith(expect.objectContaining({ draws: 200, drawLatencyP95Ms: 10, fpsP50: 50 }));
    const only = vi.fn();
    const t2 = createSessionTelemetry(only);
    t2.addDrawLatencyMs(30);
    t2.flush();
    expect(only).toHaveBeenCalledWith(expect.objectContaining({ fpsP50: null }));
  });
});

describe('reportSessionSummary', () => {
  it('envia só números e o motivo do fallback ao Sentry (nada de identidade)', () => {
    const summary = { mode: '2d' as const, fallbackReason: null, contextLosses: 0, fpsP50: null, drawLatencyP95Ms: 90, draws: 4 };
    reportSessionSummary(summary);
    expect(Sentry.captureMessage).toHaveBeenCalledWith('session-summary', { level: 'info', tags: { mode: '2d', fallback: 'none' }, extra: summary });
  });
});

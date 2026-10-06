import * as Sentry from '@sentry/nextjs';

export interface SessionSummary {
  mode: '2d' | '3d';
  fallbackReason: string | null;
  contextLosses: number;
  fpsP50: number | null;
  drawLatencyP95Ms: number | null;
  draws: number;
}

export function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.max(1, Math.ceil((p / 100) * sorted.length));
  return sorted[rank - 1];
}

export function createSessionTelemetry(report: (summary: SessionSummary) => void) {
  let mode: '2d' | '3d' = '2d';
  let fallbackReason: string | null = null;
  let contextLosses = 0;
  const frames: number[] = [];
  const latencies: number[] = [];
  let flushed = false;

  return {
    setMode(next: '2d' | '3d', reason: string | null) {
      mode = next;
      fallbackReason = reason;
    },
    addContextLoss() {
      contextLosses += 1;
    },
    addFrameDeltaMs(ms: number) {
      if (frames.length < 5_000) frames.push(ms);
    },
    addDrawLatencyMs(ms: number) {
      if (ms >= 0 && latencies.length < 200) latencies.push(ms);
    },
    flush() {
      if (flushed || (frames.length === 0 && latencies.length === 0)) return;
      flushed = true;
      const medianDelta = percentile(frames, 50);
      report({
        mode,
        fallbackReason,
        contextLosses,
        fpsP50: medianDelta ? Math.round(1000 / medianDelta) : null,
        drawLatencyP95Ms: percentile(latencies, 95),
        draws: latencies.length,
      });
    },
  };
}

/** Só números e o motivo do fallback: nunca token, e-mail ou apelido. No-op sem DSN. */
export function reportSessionSummary(summary: SessionSummary): void {
  Sentry.captureMessage('session-summary', { level: 'info', tags: { mode: summary.mode, fallback: summary.fallbackReason ?? 'none' }, extra: { ...summary } });
}

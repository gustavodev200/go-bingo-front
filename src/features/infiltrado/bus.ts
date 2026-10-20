import type { InfFrame } from '@/contracts';
import type { InfAnnouncement } from './connection';
import { Predictor } from './prediction';

export type BusEvent = { type: 'frame'; frame: InfFrame; prev: InfFrame | null } | { type: 'announcement'; msg: InfAnnouncement };

export interface TimedFrame {
  at: number;
  frame: InfFrame;
}

const MAX_FRAMES = 30;

/**
 * Hands frames from the socket to the canvas and the HUD without going through
 * React state (20 frames a second would re-render the whole page).
 */
export class InfBus {
  frames: TimedFrame[] = [];
  readonly predictor = new Predictor();
  private readonly subs = new Set<(e: BusEvent) => void>();

  get latest(): InfFrame | null {
    return this.frames[this.frames.length - 1]?.frame ?? null;
  }

  pushFrame(frame: InfFrame, at = performance.now()): void {
    const prev = this.latest;
    // Back from a meeting (everybody teleported): no blending with the old positions.
    if (prev && prev.phase !== frame.phase) this.frames = [];
    this.frames.push({ at, frame });
    if (this.frames.length > MAX_FRAMES) this.frames.shift();
    this.predictor.reconcile(frame);
    this.emit({ type: 'frame', frame, prev });
  }

  announce(msg: InfAnnouncement): void {
    this.emit({ type: 'announcement', msg });
  }

  clear(): void {
    this.frames = [];
    this.predictor.reset();
  }

  subscribe(fn: (e: BusEvent) => void): () => void {
    this.subs.add(fn);
    return () => this.subs.delete(fn);
  }

  private emit(e: BusEvent): void {
    for (const fn of this.subs) fn(e);
  }
}

/** Other divers are drawn this far in the past so there are two frames to blend. */
export const INTERP_MS = 100;

/** Interpolated position of every visible player at `renderAt`. */
export function interpolatePlayers(frames: TimedFrame[], renderAt: number): Map<number, { x: number; y: number; facing: -1 | 1; moving: boolean; flags: number }> {
  const out = new Map<number, { x: number; y: number; facing: -1 | 1; moving: boolean; flags: number }>();
  const last = frames[frames.length - 1];
  if (!last) return out;
  let a = last;
  let b = last;
  for (let i = frames.length - 1; i >= 0; i--) {
    if (frames[i].at <= renderAt) {
      a = frames[i];
      b = frames[i + 1] ?? frames[i];
      break;
    }
    a = b = frames[i];
  }
  const span = b.at - a.at;
  const t = span > 0 ? Math.min(1, Math.max(0, (renderAt - a.at) / span)) : 1;
  // Only who is visible right now (the newest frame) is drawn.
  for (const p of last.frame.players) {
    const [seat, , , facing, moving, flags] = p;
    const pa = a.frame.players.find((q) => q[0] === seat);
    const pb = b.frame.players.find((q) => q[0] === seat);
    if (pa && pb) out.set(seat, { x: pa[1] + (pb[1] - pa[1]) * t, y: pa[2] + (pb[2] - pa[2]) * t, facing: pb[3], moving: pb[4] === 1, flags });
    else out.set(seat, { x: (pb ?? p)[1], y: (pb ?? p)[2], facing, moving: moving === 1, flags });
  }
  return out;
}

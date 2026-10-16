import type { BomberFrame } from '@/contracts';
import type { BomberAnnouncement } from './connection';
import { Predictor } from './prediction';
import type { TimedFrame } from './view';

export type BusEvent = { type: 'frame'; frame: BomberFrame } | { type: 'announcement'; msg: BomberAnnouncement };

const MAX_FRAMES = 40;

/**
 * Hands frames and announcements from the socket to the arena without going
 * through React state (30 frames a second would re-render the whole page).
 */
export class ArenaBus {
  frames: TimedFrame[] = [];
  readonly predictor = new Predictor();
  mySeat = -1;
  private readonly subs = new Set<(e: BusEvent) => void>();

  setSeat(seat: number): void {
    this.mySeat = seat;
  }

  get latest(): BomberFrame | null {
    return this.frames[this.frames.length - 1]?.frame ?? null;
  }

  pushFrame(frame: BomberFrame, at = performance.now()): void {
    // A new round starts from scratch: no blending with the previous arena.
    if (this.latest && this.latest.roundNumber !== frame.roundNumber) {
      this.frames = [];
      this.predictor.reset();
    }
    this.frames.push({ at, frame });
    if (this.frames.length > MAX_FRAMES) this.frames.shift();
    if (this.mySeat >= 0) this.predictor.reconcile(frame, this.mySeat);
    this.emit({ type: 'frame', frame });
  }

  announce(msg: BomberAnnouncement): void {
    this.emit({ type: 'announcement', msg });
  }

  subscribe(fn: (e: BusEvent) => void): () => void {
    this.subs.add(fn);
    return () => this.subs.delete(fn);
  }

  private emit(e: BusEvent): void {
    for (const fn of this.subs) fn(e);
  }
}

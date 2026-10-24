import type { BotaoFrame } from '@/contracts';
import type { BotaoAnnouncement } from './connection';
import { Predictor } from './prediction';
import type { TimedFrame } from './view';

export type BusEvent = { type: 'frame'; frame: BotaoFrame } | { type: 'announcement'; msg: BotaoAnnouncement };

const MAX_FRAMES = 40;

/**
 * Leva quadros e anúncios do socket ao campo sem passar pelo estado do React
 * (30 quadros por segundo renderizariam a página toda).
 */
export class FieldBus {
  frames: TimedFrame[] = [];
  readonly predictor = new Predictor();
  mySeat = -1;
  private readonly subs = new Set<(e: BusEvent) => void>();

  setSeat(seat: number): void {
    this.mySeat = seat;
  }

  get latest(): BotaoFrame | null {
    return this.frames[this.frames.length - 1]?.frame ?? null;
  }

  pushFrame(frame: BotaoFrame, at = performance.now()): void {
    this.frames.push({ at, frame });
    if (this.frames.length > MAX_FRAMES) this.frames.shift();
    if (this.mySeat >= 0) this.predictor.reconcile(frame, this.mySeat);
    this.emit({ type: 'frame', frame });
  }

  announce(msg: BotaoAnnouncement): void {
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

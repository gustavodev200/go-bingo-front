import { INF_DT, infMove, type InfFrame } from '@/contracts';

const MAX_PENDING = 60;
const SNAP_DISTANCE = 1.5;
const ERROR_DECAY = 0.8;

/**
 * Client-side prediction of my own diver: the joystick moves it right away with
 * the same `infMove` the server runs; every frame resets to the server position
 * and replays the inputs it has not processed yet. The leftover difference
 * fades out instead of snapping.
 */
export class Predictor {
  pos: { x: number; y: number } | null = null;
  facing: -1 | 1 = 1;
  moving = false;
  ghost = false;
  private pending: { s: number; x: number; y: number }[] = [];
  private seq = 0;
  private errX = 0;
  private errY = 0;

  reset(): void {
    this.pos = null;
    this.pending = [];
    this.errX = this.errY = 0;
    this.moving = false;
  }

  reconcile(frame: InfFrame): void {
    const me = frame.me;
    this.ghost = !me.alive;
    if (!this.pos || frame.phase !== 'play' || me.vent >= 0) {
      this.pos = { x: me.x, y: me.y };
      this.pending = [];
      this.errX = this.errY = 0;
      return;
    }
    this.pending = this.pending.filter((i) => i.s > me.lastSeq);
    const p = { x: me.x, y: me.y };
    for (const i of this.pending) infMove(p, i.x, i.y, INF_DT, this.ghost);
    this.errX += this.pos.x - p.x;
    this.errY += this.pos.y - p.y;
    if (Math.hypot(this.errX, this.errY) > SNAP_DISTANCE) this.errX = this.errY = 0;
    this.pos = p;
  }

  /** One client tick: the sequence number to send, or null when I cannot move. */
  step(frame: InfFrame | null, x: number, y: number): number | null {
    if (!frame || !this.pos || frame.phase !== 'play' || frame.me.vent >= 0) {
      this.moving = false;
      return null;
    }
    const s = ++this.seq;
    this.pending.push({ s, x, y });
    if (this.pending.length > MAX_PENDING) this.pending.shift();
    const bx = this.pos.x;
    const by = this.pos.y;
    infMove(this.pos, x, y, INF_DT, this.ghost);
    this.moving = this.pos.x !== bx || this.pos.y !== by;
    if (x > 0.1) this.facing = 1;
    else if (x < -0.1) this.facing = -1;
    return s;
  }

  render(): { x: number; y: number } | null {
    if (!this.pos) return null;
    this.errX *= ERROR_DECAY;
    this.errY *= ERROR_DECAY;
    return { x: this.pos.x + this.errX, y: this.pos.y + this.errY };
  }
}

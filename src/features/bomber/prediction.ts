import { BOMBER_DT, BOMBER_OPPOSITE, movePlayer, type BomberDir, type BomberFrame, type BomberWorld } from '@/contracts';

/** Arena obstacles as the movement code sees them (bombs on the ground block). */
export function worldFrom(frame: BomberFrame): BomberWorld {
  const grounded = frame.bombs.filter((b) => b[4] === 0 && b[5] < 0);
  return {
    grid: frame.grid,
    bombAt: (x, y) => grounded.find((b) => Math.round(b[1]) === x && Math.round(b[2]) === y) ?? null,
  };
}

const MAX_PENDING = 90;
const SNAP_DISTANCE = 1.2;
const ERROR_DECAY = 0.82;

/**
 * Client-side prediction of my own bomber: inputs move it right away with the
 * same code the server runs; every frame resets to the server position and
 * replays the inputs it has not processed yet (by sequence number). The
 * leftover difference fades out instead of snapping.
 */
export class Predictor {
  pos: { x: number; y: number } | null = null;
  dir: BomberDir = 2;
  moving = false;
  speed = 3.4;
  curse: string | 0 = 0;
  alive = false;
  private pending: { s: number; d: number }[] = [];
  private seq = 0;
  private errX = 0;
  private errY = 0;

  reset(): void {
    this.pos = null;
    this.pending = [];
    this.errX = this.errY = 0;
    this.moving = false;
  }

  get pendingCount(): number {
    return this.pending.length;
  }

  /** Applies an authoritative frame. */
  reconcile(frame: BomberFrame, mySeat: number): void {
    const me = frame.players.find((p) => p[0] === mySeat);
    if (!me) {
      this.alive = false;
      return;
    }
    const [, x, y, dir, , alive, speed, curse, lastSeq] = me;
    this.speed = speed;
    this.curse = curse;
    this.alive = alive === 1;
    if (!this.pos || !this.alive || frame.phase === 'countdown') {
      this.pos = { x, y };
      this.pending = [];
      this.dir = dir;
      return;
    }
    this.pending = this.pending.filter((i) => i.s > lastSeq);
    const p = { x, y };
    const world = worldFrom(frame);
    for (const i of this.pending) movePlayer(world, p, i.d, speed * BOMBER_DT);
    this.errX += this.pos.x - p.x;
    this.errY += this.pos.y - p.y;
    if (Math.hypot(this.errX, this.errY) > SNAP_DISTANCE) this.errX = this.errY = 0;
    this.pos = p;
  }

  /**
   * One client tick: returns the sequence number to send with this input,
   * or null when my bomber cannot act (countdown, dead, no frame yet).
   */
  step(frame: BomberFrame | null, dir: number): number | null {
    if (!frame || !this.pos || !this.alive) return null;
    if (frame.phase !== 'play' && frame.phase !== 'ending') return null;
    const eff = this.curse === 'reverse' && dir ? BOMBER_OPPOSITE[dir] : dir;
    const s = ++this.seq;
    this.pending.push({ s, d: eff });
    if (this.pending.length > MAX_PENDING) this.pending.shift();
    movePlayer(worldFrom(frame), this.pos, eff, this.speed * BOMBER_DT);
    this.moving = eff !== 0;
    if (eff) this.dir = eff as BomberDir;
    return s;
  }

  /** Where to draw my bomber this frame (prediction plus the fading correction). */
  render(): { x: number; y: number } | null {
    if (!this.pos) return null;
    this.errX *= ERROR_DECAY;
    this.errY *= ERROR_DECAY;
    return { x: this.pos.x + this.errX, y: this.pos.y + this.errY };
  }
}

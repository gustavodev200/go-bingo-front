import { SNAKE_MAGNET, SNAKE_TICK_MS, type SnakeFrame, type SnakeFrameFoodIn, type SnakeMeta } from '@/contracts';

/** Render point: [index along the body (0 = head), x, y]. */
export type RenderPoint = [number, number, number];

export interface RenderSnake {
  id: number;
  radius: number;
  angle: number;
  boost: boolean;
  /** Tail first, head last (drawn on top). */
  pts: RenderPoint[];
  name: string;
  skin: number;
  isMe: boolean;
  /** Where the eyes look (my snake looks at the pointer). */
  look: number;
}

/** A dying snake flashing out. */
export interface Ghost {
  pts: RenderPoint[];
  radius: number;
  skin: number;
  t0: number;
}

/** A pellet flying into the head that ate it. */
export interface Bit {
  /** Pellet id (picks the stripe color of remains). */
  id: number;
  x: number;
  y: number;
  x0: number;
  y0: number;
  v: number;
  c: number;
  snakeId: number;
  k: number;
  t0: number;
}

export interface Scene {
  snakes: RenderSnake[];
  foods: SnakeFrameFoodIn[];
  cam: [number, number];
  me: RenderSnake | undefined;
  ghosts: Ghost[];
  bits: Bit[];
}

interface TimedFrame {
  time: number;
  frame: SnakeFrame;
}

/** Shortest time in the past the arena is shown at (with a perfect network). */
export const INTERP_DELAY_MS = SNAKE_TICK_MS * 2;
const MAX_DELAY_MS = 350;
/** When the next frame is late, keep moving along the last motion for at most this much of a tick. */
const MAX_EXTRAPOLATION = 0.6;
const MAX_FRAMES = 30;
const GHOST_MS = 500;
const BIT_MS = 180;
const MAX_BITS = 200;
const TAU = Math.PI * 2;

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export function lerpAngle(a: number, b: number, t: number) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return a + d * t;
}

/**
 * Everything the canvas needs, kept outside React: frame buffer with a
 * server clock estimate, interpolation, names/skins, and small effects.
 */
export class SnakeView {
  private frames: TimedFrame[] = [];
  private offset: number | null = null;
  /** How late frames arrive compared to the best one (network jitter), smoothed. */
  private jitter = 0;
  /** Current interpolation delay: grows fast when frames come late, shrinks slowly. */
  delay = INTERP_DELAY_MS;
  private meta = new Map<number, { name: string; skin: number }>();
  private ghosts: Ghost[] = [];
  private bits: Bit[] = [];
  private last = new Map<number, RenderSnake>();
  myId = 0;
  /** Own mass from the latest frame (0 while not playing). */
  myMass = 0;

  get latest(): SnakeFrame | null {
    return this.frames[this.frames.length - 1]?.frame ?? null;
  }

  /** Which snake is mine (0 = none). */
  setMe(id: number): void {
    this.myId = id;
  }

  reset(): void {
    this.frames = [];
    this.offset = null;
    this.jitter = 0;
    this.delay = INTERP_DELAY_MS;
    this.ghosts = [];
    this.bits = [];
  }

  setMeta(list: SnakeMeta[]): void {
    this.meta.clear();
    this.addMeta(list);
  }

  addMeta(list: SnakeMeta[]): void {
    for (const [id, name, skin] of list) this.meta.set(id, { name, skin });
  }

  push(frame: SnakeFrame, now = performance.now()): void {
    // offset = local time - server time, tracking the earliest arrival (least delayed).
    const sample = now - frame.tick * SNAKE_TICK_MS;
    if (this.offset === null || sample < this.offset || sample - this.offset > 1000) this.offset = sample;
    else this.offset += (sample - this.offset) * 0.002;
    const late = sample - this.offset;
    this.jitter += (late - this.jitter) * (late > this.jitter ? 0.3 : 0.01);
    const target = Math.min(MAX_DELAY_MS, INTERP_DELAY_MS + this.jitter * 1.3);
    this.delay += (target - this.delay) * (target > this.delay ? 0.2 : 0.02);
    const prev = this.latest;
    if (prev) this.detectEaten(prev, frame, now);
    this.myMass = frame.myMass;
    this.frames.push({ time: frame.tick * SNAKE_TICK_MS, frame });
    if (this.frames.length > MAX_FRAMES) this.frames.shift();
  }

  /** A snake died: if it was on screen it flashes out where it was. */
  onDeath(snakeId: number, now = performance.now()): void {
    const s = this.last.get(snakeId);
    if (s) this.ghosts.push({ pts: s.pts, radius: s.radius, skin: s.skin, t0: now });
  }

  /** Pellets that vanished next to a head were eaten: animate them flying in. */
  private detectEaten(prev: SnakeFrame, cur: SnakeFrame, now: number): void {
    const heads: [number, [number, number], number][] = [];
    for (const s of cur.snakes.values()) {
      const h = s.pts.get(0);
      if (h) heads.push([s.id, h, s.radius]);
    }
    if (!heads.length) return;
    for (const f of prev.foods.values()) {
      if (cur.foods.has(f.id)) continue;
      const eater = heads.find(([, h, r]) => Math.hypot(f.x - h[0], f.y - h[1]) < r + SNAKE_MAGNET + 30);
      if (eater)
        this.bits.push({
          x: f.x,
          y: f.y,
          x0: f.x,
          y0: f.y,
          v: f.v,
          c: f.c,
          id: f.id,
          snakeId: eater[0],
          k: 0,
          t0: now,
        });
    }
    if (this.bits.length > MAX_BITS) this.bits.splice(0, this.bits.length - MAX_BITS);
  }

  /** Interpolated scene at local time `now`; null before the first frame. */
  scene(now: number, look: number): Scene | null {
    const frames = this.frames;
    if (!frames.length || this.offset === null) return null;
    const rt = now - this.offset - this.delay;
    let i = frames.length - 1;
    while (i > 0 && frames[i].time > rt) i--;
    // Past the newest frame: blend forward from the last two instead of freezing.
    if (i === frames.length - 1 && i > 0) i--;
    const f0 = frames[i];
    const f1 = frames[i + 1] ?? f0;
    const t = f1 === f0 ? 0 : Math.max(0, Math.min(1 + MAX_EXTRAPOLATION, (rt - f0.time) / (f1.time - f0.time)));
    if (i > 2) frames.splice(0, i - 2);
    const a0 = f0.frame;
    const a1 = f1.frame;

    const snakes: RenderSnake[] = [];
    const last = new Map<number, RenderSnake>();
    for (const b of a1.snakes.values()) {
      const a = a0.snakes.get(b.id);
      const pts: RenderPoint[] = [];
      for (const [idx, p1] of b.pts) {
        const p0 = a?.pts.get(idx) ?? p1;
        pts.push([idx, lerp(p0[0], p1[0], t), lerp(p0[1], p1[1], t)]);
      }
      pts.reverse();
      const meta = this.meta.get(b.id) ?? { name: '', skin: 0 };
      const isMe = b.id === this.myId;
      const angle = a ? lerpAngle(a.angle, b.angle, t) : b.angle;
      const s: RenderSnake = {
        id: b.id,
        radius: a ? lerp(a.radius, b.radius, t) : b.radius,
        angle,
        boost: b.boost,
        pts,
        name: meta.name,
        skin: meta.skin,
        isMe,
        look: isMe ? look : angle,
      };
      snakes.push(s);
      last.set(b.id, s);
    }
    this.last = last;
    // Bigger ones below, mine always on top.
    snakes.sort((x, y) => Number(x.isMe) - Number(y.isMe) || y.radius - x.radius);

    for (const b of this.bits) {
      b.k = Math.min(1, (now - b.t0) / BIT_MS);
      const h = last.get(b.snakeId)?.pts.at(-1);
      if (h) {
        b.x = lerp(b.x0, h[1], b.k);
        b.y = lerp(b.y0, h[2], b.k);
      }
    }
    this.bits = this.bits.filter((b) => b.k < 1);
    this.ghosts = this.ghosts.filter((g) => now - g.t0 < GHOST_MS);

    return {
      snakes,
      foods: [...a1.foods.values()],
      cam: [lerp(a0.camX, a1.camX, t), lerp(a0.camY, a1.camY, t)],
      me: last.get(this.myId),
      ghosts: this.ghosts,
      bits: this.bits,
    };
  }
}

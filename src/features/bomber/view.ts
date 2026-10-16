import { BOMBER_SUDDEN_DEATH_AT, type BomberCurse, type BomberDir, type BomberFrame, type BomberFrameDrop, type BomberFrameFlame } from '@/contracts';

export interface RenderPlayer {
  seat: number;
  color: number;
  x: number;
  y: number;
  dir: BomberDir;
  moving: boolean;
  alive: boolean;
  curse: BomberCurse | 0;
}

export interface RenderBomb {
  id: number;
  x: number;
  y: number;
  remote: boolean;
  fly: [number, number, number, number, number] | null;
  /** Seat holding it, or -1. */
  heldBy: number;
  /** 1 fresh → 0 about to explode. */
  fuse: number;
}

export interface ArenaView {
  grid: string;
  flames: BomberFrameFlame[];
  drops: BomberFrameDrop[];
  bombs: RenderBomb[];
  players: RenderPlayer[];
  mySeat: number;
  /** Seconds left of the "this is you" marker. */
  introLeft: number;
  hurry: boolean;
}

export interface TimedFrame {
  /** performance.now() when it arrived. */
  at: number;
  frame: BomberFrame;
}

/** Other bombers are drawn this far in the past so there are two frames to blend. */
export const INTERP_MS = 70;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** The two buffered frames around `renderAt` and the blend factor between them. */
export function bracket(frames: TimedFrame[], renderAt: number): { a: TimedFrame; b: TimedFrame; t: number } {
  const last = frames[frames.length - 1];
  for (let i = frames.length - 1; i >= 0; i--) {
    if (frames[i].at > renderAt) continue;
    const a = frames[i];
    const b = frames[i + 1] ?? a;
    const span = b.at - a.at;
    return { a, b, t: span > 0 ? Math.min(1, Math.max(0, (renderAt - a.at) / span)) : 1 };
  }
  return { a: frames[0] ?? last, b: frames[0] ?? last, t: 1 };
}

/**
 * Scene to draw at `now`: the arena from the newest frame (so explosions show
 * up at once), other bombers and sliding bombs interpolated, my bomber from prediction.
 */
export function buildView(
  frames: TimedFrame[],
  now: number,
  opts: { mySeat: number; colorOf(seat: number): number; me: { pos: { x: number; y: number } | null; dir: BomberDir; moving: boolean }; introLeft: number },
): ArenaView | null {
  if (!frames.length) return null;
  const latest = frames[frames.length - 1].frame;
  const { a, b, t } = bracket(frames, now - INTERP_MS);
  const f0 = a.frame;
  const f1 = b.frame;
  const meAlive = latest.players.find((p) => p[0] === opts.mySeat)?.[5] === 1;

  const players = f1.players.map((p1): RenderPlayer => {
    const p0 = f0.players.find((q) => q[0] === p1[0]) ?? p1;
    const src = t < 0.5 ? p0 : p1;
    const pl: RenderPlayer = {
      seat: p1[0],
      color: opts.colorOf(p1[0]),
      x: lerp(p0[1], p1[1], t),
      y: lerp(p0[2], p1[2], t),
      dir: src[3],
      moving: src[4] === 1,
      alive: src[5] === 1,
      curse: src[7],
    };
    if (pl.seat === opts.mySeat && meAlive && opts.me.pos) {
      pl.x = opts.me.pos.x;
      pl.y = opts.me.pos.y;
      pl.dir = opts.me.dir;
      pl.moving = opts.me.moving;
      pl.alive = true;
    }
    return pl;
  });

  const bombs = f1.bombs.map((b1): RenderBomb => {
    const b0 = f0.bombs.find((q) => q[0] === b1[0]);
    const grounded = !!b0 && b1[4] === 0 && b1[5] < 0;
    return {
      id: b1[0],
      x: grounded ? lerp(b0[1], b1[1], t) : b1[1],
      y: grounded ? lerp(b0[2], b1[2], t) : b1[2],
      remote: b1[3] === 1,
      fly: b1[4] === 0 ? null : b1[4],
      heldBy: b1[5],
      fuse: b1[6],
    };
  });

  return {
    grid: latest.grid,
    flames: latest.flames,
    drops: latest.drops,
    bombs,
    players,
    mySeat: opts.mySeat,
    introLeft: opts.introLeft,
    hurry: latest.timeLeft <= BOMBER_SUDDEN_DEATH_AT && latest.phase === 'play',
  };
}

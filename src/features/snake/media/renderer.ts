import { SNAKE_SKINS, snakeFoodColor, type SnakeFrameFoodIn } from '@/contracts';
import type { Bit, Ghost, RenderSnake } from '../view';

const TAU = Math.PI * 2;
const STRIPE = 3;
/** Sprite caches are rebuilt from scratch when they grow past this (zoom changes create new sizes). */
const MAX_SPRITES = 400;

export type QualityLevel = 0 | 1 | 2;

export interface Quality {
  /** Canvas pixels per CSS pixel (below 1 = rendered smaller and stretched). */
  dpr: number;
  /** Draw every Nth body point of long snakes (circles still overlap at 2). */
  bodyStep: number;
  /** Pulsing pellets, boost glow, death flash, eaten pellets flying. */
  effects: boolean;
  /** Target frame interval; 0 = every animation frame. */
  frameMs: number;
}

/** 0 = weak phones, 1 = most phones, 2 = desktop/strong devices. */
export function qualityFor(level: QualityLevel): Quality {
  const native = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;
  if (level === 2) return { dpr: Math.min(native, 2), bodyStep: 1, effects: true, frameMs: 0 };
  if (level === 1) return { dpr: Math.min(native, 1.25), bodyStep: 2, effects: false, frameMs: 0 };
  return { dpr: Math.min(native, 0.8), bodyStep: 2, effects: false, frameMs: 1000 / 32 };
}

/** Starting level from what the device tells about itself; the frame-time governor adjusts it later. */
export function initialQuality(): QualityLevel {
  if (typeof navigator === 'undefined') return 1;
  const cores = navigator.hardwareConcurrency || 4;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;
  const coarse = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;
  if (cores <= 4 || memory <= 2) return 0;
  return coarse ? 1 : 2;
}

/**
 * Watches frame intervals and the time each frame takes to draw. Steps the
 * quality down quickly when frames are late or heavy, and back up slowly
 * when drawing is cheap (the interval alone can't tell: low quality caps it).
 */
export class QualityGovernor {
  private interval = 16;
  private work = 4;
  private slowFor = 0;
  private fastFor = 0;
  /** Smooth time needed before going up; doubles on every drop so it never flip-flops. */
  private upAfter = 8000;

  constructor(public level: QualityLevel) {}

  /** Feeds one frame; returns true when the level changed. */
  sample(intervalMs: number, workMs: number): boolean {
    this.interval += (Math.min(intervalMs, 100) - this.interval) * 0.1;
    this.work += (Math.min(workMs, 100) - this.work) * 0.1;
    const budget = qualityFor(this.level).frameMs || 1000 / 60;
    if (this.interval > budget * 1.35 || this.work > 12) {
      this.slowFor += intervalMs;
      this.fastFor = 0;
    } else if (this.work < 5 && this.interval < budget * 1.1) {
      this.fastFor += intervalMs;
      this.slowFor = 0;
    } else this.slowFor = this.fastFor = 0;
    if (this.slowFor > 1500 && this.level > 0) {
      this.upAfter = Math.min(this.upAfter * 2, 120_000);
      return this.set((this.level - 1) as QualityLevel);
    }
    if (this.fastFor > this.upAfter && this.level < 2) return this.set((this.level + 1) as QualityLevel);
    return false;
  }

  private set(level: QualityLevel): boolean {
    this.level = level;
    this.slowFor = this.fastFor = 0;
    this.interval = 16;
    this.work = 4;
    return true;
  }
}

function shade(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v * k)));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

const skinOf = (skin: number) => SNAKE_SKINS[skin] ?? SNAKE_SKINS[0];
const pelletRadius = (v: number) => 3.2 + Math.sqrt(v) * 3;

/** World → canvas pixels: x * k + ox. */
interface ToPx {
  k: number;
  ox: number;
  oy: number;
}

export interface DrawInput {
  cam: [number, number];
  /** CSS pixels per world unit. */
  scale: number;
  arenaR: number;
  time: number;
  snakes: RenderSnake[];
  foods: SnakeFrameFoodIn[];
  ghosts: Ghost[];
  bits: Bit[];
}

/**
 * Neon arena on a 2D canvas. Everything round is pre-rendered once into
 * small sprites (body segments per color and on-screen size, glowing
 * pellets), so a frame is mostly drawImage calls: cheap even on weak phones.
 */
export class SnakeRenderer {
  private readonly ctx: CanvasRenderingContext2D;
  private quality = qualityFor(1);
  w = 0;
  h = 0;
  private readonly bodySprites = new Map<string, HTMLCanvasElement>();
  private readonly foodSprites = new Map<string, HTMLCanvasElement>();
  private readonly hexTile: HTMLCanvasElement;
  private hexPattern: CanvasPattern | null = null;

  constructor(private readonly cv: HTMLCanvasElement) {
    this.ctx = cv.getContext('2d', { alpha: false, desynchronized: true })!;
    this.hexTile = makeHexTile();
  }

  setQuality(q: Quality): void {
    this.quality = q;
    this.resize(this.w, this.h);
  }

  resize(w: number, h: number): void {
    this.w = w;
    this.h = h;
    this.cv.width = Math.max(1, Math.round(w * this.quality.dpr));
    this.cv.height = Math.max(1, Math.round(h * this.quality.dpr));
  }

  /** One body segment (shadow, rim, fill, gloss) at `px` canvas pixels of radius. */
  private bodySprite(color: string, px: number): HTMLCanvasElement {
    const key = `${color}|${px}`;
    let sp = this.bodySprites.get(key);
    if (sp) return sp;
    if (this.bodySprites.size > MAX_SPRITES) this.bodySprites.clear();
    const pad = Math.ceil(px * 0.25) + 2;
    const size = (px + pad) * 2;
    sp = document.createElement('canvas');
    sp.width = sp.height = size;
    const g = sp.getContext('2d')!;
    const c = size / 2;
    g.fillStyle = 'rgba(0,0,0,0.45)';
    g.beginPath();
    g.arc(c, c + px * 0.15, px * 1.12, 0, TAU);
    g.fill();
    g.fillStyle = shade(color, 0.72);
    g.beginPath();
    g.arc(c, c, px, 0, TAU);
    g.fill();
    g.fillStyle = color;
    g.beginPath();
    g.arc(c - px * 0.12, c - px * 0.12, px * 0.82, 0, TAU);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,0.22)';
    g.beginPath();
    g.arc(c - px * 0.35, c - px * 0.35, px * 0.28, 0, TAU);
    g.fill();
    this.bodySprites.set(key, sp);
    return sp;
  }

  private foodSprite(color: string): HTMLCanvasElement {
    let sp = this.foodSprites.get(color);
    if (sp) return sp;
    sp = document.createElement('canvas');
    sp.width = sp.height = 32;
    const g = sp.getContext('2d')!;
    const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.2, color);
    grad.addColorStop(0.4, color + '99');
    grad.addColorStop(1, color + '00');
    g.fillStyle = grad;
    g.fillRect(0, 0, 32, 32);
    this.foodSprites.set(color, sp);
    return sp;
  }

  draw(v: DrawInput): void {
    const { ctx, w, h } = this;
    const dpr = this.quality.dpr;
    const sc = v.scale;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#0b1020';
    ctx.fillRect(0, 0, w, h);

    const tx = w / 2 - v.cam[0] * sc;
    const ty = h / 2 - v.cam[1] * sc;
    ctx.setTransform(dpr * sc, 0, 0, dpr * sc, dpr * tx, dpr * ty);
    const vx0 = v.cam[0] - w / 2 / sc;
    const vy0 = v.cam[1] - h / 2 / sc;
    const vw = w / sc;
    const vh = h / sc;

    this.hexPattern ??= ctx.createPattern(this.hexTile, 'repeat');
    if (this.hexPattern) {
      ctx.fillStyle = this.hexPattern;
      ctx.fillRect(vx0, vy0, vw, vh);
    }
    this.drawBorder(v.arenaR, vx0, vy0, vw, vh, sc);
    this.drawFood(v.foods, v.time, vx0, vy0, vw, vh);
    if (this.quality.effects) for (const g of v.ghosts) this.drawGhost(g, v.time);
    const toPx: ToPx = { k: sc * dpr, ox: dpr * tx, oy: dpr * ty };
    for (const s of v.snakes) this.drawSnake(s, toPx, vx0, vy0, vw, vh);
    ctx.font = `800 ${13 / sc}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    for (const s of v.snakes) if (!s.isMe && s.name) this.drawName(s, sc);
    if (this.quality.effects) this.drawBits(v.bits);
  }

  private drawBorder(R: number, vx0: number, vy0: number, vw: number, vh: number, sc: number) {
    // Nothing to draw while the whole screen is inside the arena.
    if (Math.hypot(vx0 + vw / 2, vy0 + vh / 2) + Math.hypot(vw, vh) / 2 < R - 20) return;
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.rect(vx0, vy0, vw, vh);
    ctx.arc(0, 0, R, 0, TAU, true);
    ctx.fillStyle = 'rgba(120, 10, 30, 0.55)';
    ctx.fill('evenodd');
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, TAU);
    ctx.lineWidth = Math.max(6, 3 / sc);
    ctx.strokeStyle = '#ff3355';
    ctx.stroke();
  }

  private drawFood(foods: SnakeFrameFoodIn[], time: number, vx0: number, vy0: number, vw: number, vh: number) {
    const ctx = this.ctx;
    const pulse = this.quality.effects;
    for (const f of foods) {
      if (f.x < vx0 - 30 || f.x > vx0 + vw + 30 || f.y < vy0 - 30 || f.y > vy0 + vh + 30) continue;
      let r = pelletRadius(f.v) * 2.2;
      if (pulse) r *= 1 + 0.18 * Math.sin(time * 0.005 + f.id * 1.7);
      ctx.drawImage(this.foodSprite(snakeFoodColor(f.c)), f.x - r, f.y - r, r * 2, r * 2);
    }
  }

  private drawSnake(s: RenderSnake, toPx: ToPx, vx0: number, vy0: number, vw: number, vh: number) {
    const ctx = this.ctx;
    const colors = skinOf(s.skin);
    const pts = s.pts;
    if (!pts.length) return;
    const r = s.radius;
    // Sprite sizes snap to 2 px steps so zooming keeps reusing them.
    const px = Math.max(2, Math.round((r * toPx.k) / 2) * 2);
    const sprites = colors.map((c) => this.bodySprite(c, px));
    const half = sprites[0].width / 2;
    const step = pts.length > 40 ? this.quality.bodyStep : 1;
    const m = r * 2;
    const x0 = vx0 - m;
    const x1 = vx0 + vw + m;
    const y0 = vy0 - m;
    const y1 = vy0 + vh + m;

    if (s.boost && this.quality.effects) {
      ctx.globalAlpha = 0.35;
      const glow = this.foodSprite(colors[0]);
      for (let i = 0; i < pts.length; i += 3) {
        const p = pts[i];
        ctx.drawImage(glow, p[1] - r * 2, p[2] - r * 2, r * 4, r * 4);
      }
      ctx.globalAlpha = 1;
    }

    // Tail first so the head ends on top; the head is always drawn. Segments are
    // blitted 1:1 at whole canvas pixels (no scaling): the fastest drawImage path.
    const last = pts.length - 1;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    for (let i = last % step; i <= last; i += step) {
      const p = pts[i];
      if (p[1] < x0 || p[1] > x1 || p[2] < y0 || p[2] > y1) continue;
      ctx.drawImage(sprites[Math.floor(p[0] / STRIPE) % sprites.length], Math.round(p[1] * toPx.k + toPx.ox - half), Math.round(p[2] * toPx.k + toPx.oy - half));
    }
    ctx.restore();

    const head = pts[last];
    if (head[0] !== 0) return;
    const a = s.angle;
    const ex = Math.cos(a + Math.PI / 2) * r * 0.48;
    const ey = Math.sin(a + Math.PI / 2) * r * 0.48;
    const fx = head[1] + Math.cos(a) * r * 0.35;
    const fy = head[2] + Math.sin(a) * r * 0.35;
    const er = r * 0.42;
    const lx = Math.cos(s.look) * er * 0.4;
    const ly = Math.sin(s.look) * er * 0.4;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    for (const side of [-1, 1]) {
      ctx.moveTo(fx + ex * side + er, fy + ey * side);
      ctx.arc(fx + ex * side, fy + ey * side, er, 0, TAU);
    }
    ctx.fill();
    ctx.fillStyle = '#10131f';
    ctx.beginPath();
    for (const side of [-1, 1]) {
      ctx.moveTo(fx + ex * side + lx + er * 0.55, fy + ey * side + ly);
      ctx.arc(fx + ex * side + lx, fy + ey * side + ly, er * 0.55, 0, TAU);
    }
    ctx.fill();
  }

  private drawName(s: RenderSnake, sc: number) {
    const head = s.pts[s.pts.length - 1];
    if (!head || head[0] !== 0) return;
    this.ctx.fillText(s.name, head[1], head[2] - s.radius - 10 / sc);
  }

  private drawGhost(g: Ghost, time: number) {
    const k = Math.min(1, (time - g.t0) / 500);
    if (k >= 1) return;
    const ctx = this.ctx;
    const colors = skinOf(g.skin);
    ctx.globalAlpha = (1 - k) * 0.7;
    const r = g.radius * (1.4 + k * 1.2);
    for (let i = 0; i < g.pts.length; i += 2) {
      const p = g.pts[i];
      ctx.drawImage(this.foodSprite(colors[Math.floor(p[0] / STRIPE) % colors.length]), p[1] - r, p[2] - r, r * 2, r * 2);
    }
    ctx.globalAlpha = 1;
  }

  private drawBits(bits: Bit[]) {
    const ctx = this.ctx;
    for (const b of bits) {
      const r = pelletRadius(b.v) * 2.2 * (1 - b.k * 0.7);
      ctx.globalAlpha = 1 - b.k;
      ctx.drawImage(this.foodSprite(snakeFoodColor(b.c)), b.x - r, b.y - r, r * 2, r * 2);
    }
    ctx.globalAlpha = 1;
  }
}

/** Flat-top hex floor tile in world units; inset hexes leave dark seams as grid lines. */
function makeHexTile(): HTMLCanvasElement {
  const S = 30;
  const w = S * 3;
  const h = 52; // sqrt(3) * 30 ≈ 52 keeps the tile integer-sized
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  if (!g) return c;
  g.fillStyle = '#0d1328';
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#152042';
  const r = S - 2.5;
  const ky = h / (S * Math.sqrt(3));
  g.beginPath();
  for (const [cx, cy] of [
    [0, 0],
    [w, 0],
    [0, h],
    [w, h],
    [w / 2, h / 2],
  ]) {
    g.moveTo(cx + r, cy);
    for (let i = 1; i <= 6; i++) g.lineTo(cx + r * Math.cos((i * TAU) / 6), cy + r * ky * Math.sin((i * TAU) / 6));
  }
  g.fill();
  return c;
}

/** Wavy preview snake for the skin picker. */
export function drawSkinPreview(canvas: HTMLCanvasElement, skin: number, t: number): void {
  const g = canvas.getContext('2d');
  if (!g) return;
  const W = canvas.width;
  const H = canvas.height;
  g.clearRect(0, 0, W, H);
  const colors = skinOf(skin);
  const r = 14;
  const pts: [number, number, number][] = [];
  for (let i = 0; i < 30; i++) pts.push([29 - i, 30 + i * 7, H / 2 + Math.sin(i * 0.35 - t * 0.004) * 12]);
  g.fillStyle = 'rgba(0,0,0,0.4)';
  for (const p of pts) {
    g.beginPath();
    g.arc(p[1], p[2] + 2, r + 2, 0, TAU);
    g.fill();
  }
  for (const p of pts) {
    const ci = Math.floor(p[0] / STRIPE) % colors.length;
    g.fillStyle = shade(colors[ci], 0.72);
    g.beginPath();
    g.arc(p[1], p[2], r, 0, TAU);
    g.fill();
    g.fillStyle = colors[ci];
    g.beginPath();
    g.arc(p[1] - 2, p[2] - 2, r * 0.82, 0, TAU);
    g.fill();
  }
  const hd = pts[pts.length - 1];
  for (const side of [-1, 1]) {
    g.fillStyle = '#fff';
    g.beginPath();
    g.arc(hd[1] + 4, hd[2] + side * 6, 5.5, 0, TAU);
    g.fill();
    g.fillStyle = '#10131f';
    g.beginPath();
    g.arc(hd[1] + 6, hd[2] + side * 6, 3, 0, TAU);
    g.fill();
  }
}

export function drawMinimap(canvas: HTMLCanvasElement, arenaR: number, dots: [number, number][], me: [number, number] | null): void {
  const g = canvas.getContext('2d');
  if (!g) return;
  const W = canvas.width;
  const c = W / 2;
  const k = (c - 6) / arenaR;
  g.clearRect(0, 0, W, W);
  g.fillStyle = 'rgba(0,0,0,0.45)';
  g.beginPath();
  g.arc(c, c, c - 2, 0, TAU);
  g.fill();
  g.strokeStyle = '#ff3355';
  g.lineWidth = 3;
  g.beginPath();
  g.arc(c, c, c - 4, 0, TAU);
  g.stroke();
  g.fillStyle = '#ffd23f';
  for (const [x, y] of dots) {
    g.beginPath();
    g.arc(c + x * k, c + y * k, 3.5, 0, TAU);
    g.fill();
  }
  if (me) {
    g.fillStyle = '#3cf27a';
    g.strokeStyle = '#fff';
    g.lineWidth = 2;
    g.beginPath();
    g.arc(c + me[0] * k, c + me[1] * k, 6, 0, TAU);
    g.fill();
    g.stroke();
  }
}

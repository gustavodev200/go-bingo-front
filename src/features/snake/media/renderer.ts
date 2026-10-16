import { SNAKE_SKINS, snakeFoodColor, type SnakeFrameFoodIn } from '@/contracts';
import type { Bit, Ghost, RenderSnake } from '../view';

const TAU = Math.PI * 2;
const STRIPE = 3;

function shade(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v * k)));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

const skinOf = (skin: number) => SNAKE_SKINS[skin] ?? SNAKE_SKINS[0];
const pelletRadius = (v: number) => 3.2 + Math.sqrt(v) * 3;

export interface DrawInput {
  cam: [number, number];
  /** Screen pixels per world unit. */
  scale: number;
  arenaR: number;
  time: number;
  snakes: RenderSnake[];
  foods: SnakeFrameFoodIn[];
  ghosts: Ghost[];
  bits: Bit[];
}

/** Neon arena on a 2D canvas: hex floor, glowing pellets, striped snakes with eyes, red border. */
export class SnakeRenderer {
  private readonly ctx: CanvasRenderingContext2D;
  private dpr = 1;
  w = 0;
  h = 0;
  private readonly sprites = new Map<string, HTMLCanvasElement>();
  private hexTile: HTMLCanvasElement;
  private hexPattern: CanvasPattern | null = null;

  constructor(private readonly cv: HTMLCanvasElement) {
    this.ctx = cv.getContext('2d', { alpha: false })!;
    this.hexTile = makeHexTile();
  }

  resize(w: number, h: number): void {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = w;
    this.h = h;
    this.cv.width = Math.round(w * this.dpr);
    this.cv.height = Math.round(h * this.dpr);
  }

  private foodSprite(color: string): HTMLCanvasElement {
    let sp = this.sprites.get(color);
    if (sp) return sp;
    sp = document.createElement('canvas');
    sp.width = sp.height = 64;
    const g = sp.getContext('2d')!;
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.18, color);
    grad.addColorStop(0.35, color + 'aa');
    grad.addColorStop(1, color + '00');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    this.sprites.set(color, sp);
    return sp;
  }

  draw(v: DrawInput): void {
    const { ctx, dpr, w, h } = this;
    const sc = v.scale;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
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
    for (const g of v.ghosts) this.drawGhost(g, v.time);
    for (const s of v.snakes) this.drawSnake(s);
    for (const s of v.snakes) if (!s.isMe && s.name) this.drawName(s, sc);
    this.drawBits(v.bits);
  }

  private drawBorder(R: number, vx0: number, vy0: number, vw: number, vh: number, sc: number) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.rect(vx0, vy0, vw, vh);
    ctx.arc(0, 0, R, 0, TAU, true);
    ctx.fillStyle = 'rgba(120, 10, 30, 0.55)';
    ctx.fill('evenodd');
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, TAU);
    ctx.lineWidth = 26;
    ctx.strokeStyle = 'rgba(255, 50, 80, 0.18)';
    ctx.stroke();
    ctx.lineWidth = Math.max(6, 3 / sc);
    ctx.strokeStyle = '#ff3355';
    ctx.stroke();
  }

  private drawFood(foods: SnakeFrameFoodIn[], time: number, vx0: number, vy0: number, vw: number, vh: number) {
    const ctx = this.ctx;
    ctx.globalCompositeOperation = 'lighter';
    for (const f of foods) {
      if (f.x < vx0 - 30 || f.x > vx0 + vw + 30 || f.y < vy0 - 30 || f.y > vy0 + vh + 30) continue;
      const r = pelletRadius(f.v) * (1 + 0.18 * Math.sin(time * 0.005 + f.id * 1.7));
      ctx.drawImage(this.foodSprite(snakeFoodColor(f.c)), f.x - r * 2.2, f.y - r * 2.2, r * 4.4, r * 4.4);
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  private drawSnake(s: RenderSnake) {
    const ctx = this.ctx;
    const colors = skinOf(s.skin);
    const pts = s.pts;
    if (!pts.length) return;
    const r = s.radius;

    if (s.boost) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = colors[0] + '30';
      ctx.beginPath();
      for (let i = 0; i < pts.length; i += 2) {
        const p = pts[i];
        ctx.moveTo(p[1] + r * 1.7, p[2]);
        ctx.arc(p[1], p[2], r * 1.7, 0, TAU);
      }
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }

    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    for (const p of pts) {
      ctx.moveTo(p[1] + r + 2.5, p[2] + 2);
      ctx.arc(p[1], p[2] + 2, r + 2.5, 0, TAU);
    }
    ctx.fill();

    const darks = colors.map((c) => shade(c, 0.72));
    for (const p of pts) {
      const ci = Math.floor(p[0] / STRIPE) % colors.length;
      ctx.fillStyle = darks[ci];
      ctx.beginPath();
      ctx.arc(p[1], p[2], r, 0, TAU);
      ctx.fill();
      ctx.fillStyle = colors[ci];
      ctx.beginPath();
      ctx.arc(p[1] - r * 0.12, p[2] - r * 0.12, r * 0.82, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.beginPath();
    for (const p of pts) {
      const gx = p[1] - r * 0.35;
      const gy = p[2] - r * 0.35;
      ctx.moveTo(gx + r * 0.28, gy);
      ctx.arc(gx, gy, r * 0.28, 0, TAU);
    }
    ctx.fill();

    const head = pts[pts.length - 1];
    if (head[0] !== 0) return;
    const a = s.angle;
    const ex = Math.cos(a + Math.PI / 2);
    const ey = Math.sin(a + Math.PI / 2);
    const fx = Math.cos(a) * r * 0.35;
    const fy = Math.sin(a) * r * 0.35;
    const er = r * 0.42;
    const lx = Math.cos(s.look) * er * 0.4;
    const ly = Math.sin(s.look) * er * 0.4;
    for (const side of [-1, 1]) {
      const x = head[1] + ex * r * 0.48 * side + fx;
      const y = head[2] + ey * r * 0.48 * side + fy;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(x, y, er, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#10131f';
      ctx.beginPath();
      ctx.arc(x + lx, y + ly, er * 0.55, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(x + lx - er * 0.18, y + ly - er * 0.18, er * 0.16, 0, TAU);
      ctx.fill();
    }
  }

  private drawName(s: RenderSnake, sc: number) {
    const head = s.pts[s.pts.length - 1];
    if (!head || head[0] !== 0) return;
    const ctx = this.ctx;
    ctx.font = `800 ${13 / sc}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.lineWidth = 3 / sc;
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    const y = head[2] - s.radius - 10 / sc;
    ctx.strokeText(s.name, head[1], y);
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.fillText(s.name, head[1], y);
  }

  private drawGhost(g: Ghost, time: number) {
    const k = Math.min(1, (time - g.t0) / 500);
    if (k >= 1) return;
    const ctx = this.ctx;
    const colors = skinOf(g.skin);
    ctx.globalAlpha = (1 - k) * 0.8;
    ctx.globalCompositeOperation = 'lighter';
    for (const p of g.pts) {
      ctx.fillStyle = colors[Math.floor(p[0] / STRIPE) % colors.length];
      ctx.beginPath();
      ctx.arc(p[1], p[2], g.radius * (1 + k * 0.8), 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  private drawBits(bits: Bit[]) {
    const ctx = this.ctx;
    ctx.globalCompositeOperation = 'lighter';
    for (const b of bits) {
      const r = pelletRadius(b.v) * (1 - b.k * 0.7);
      ctx.globalAlpha = 1 - b.k;
      ctx.drawImage(this.foodSprite(snakeFoodColor(b.c)), b.x - r * 2.2, b.y - r * 2.2, r * 4.4, r * 4.4);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
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

import { INF_BUTTON, INF_COLS, INF_ROWS, infRayLength } from '@/contracts';
import { renderMap, TS } from './map-art';
import { SpriteCache } from './sprites';

export interface RenderDiver {
  seat: number;
  x: number;
  y: number;
  color: number;
  facing: -1 | 1;
  moving: boolean;
  ghost: boolean;
  name: string;
  /** Name in red (a fellow infiltrator, seen by infiltrators). */
  mate: boolean;
}

export interface RenderView {
  /** Camera target (my predicted position). */
  cx: number;
  cy: number;
  me: RenderDiver | null;
  others: RenderDiver[];
  bodies: { seat: number; x: number; y: number; color: number }[];
  /** Vision radius in tiles; null = no fog (ghosts). */
  vision: number | null;
  /** Spots to pulse (my tasks, repair panels, vents nearby...). */
  marks: { x: number; y: number; color: string }[];
  /** Off-screen targets to point at with arrows (critical repairs). */
  arrows: { x: number; y: number; color: string }[];
  critical: boolean;
  t: number;
}

const RAYS = 144;
/** The fog is drawn at this fraction of the screen and scaled up (soft edges for free). */
const FOG_SCALE = 0.25;
const FOG = 'rgba(1,6,14,0.93)';

/**
 * Canvas renderer: blits the visible part of the pre-rendered station, draws
 * divers and bodies sorted by depth, then the fog of war cut by the walls
 * (a visibility polygon ray-cast from my position).
 */
export class InfRenderer {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly map: HTMLCanvasElement;
  private readonly fog: HTMLCanvasElement;
  private readonly fogCtx: CanvasRenderingContext2D;
  private w = 0;
  private h = 0;
  private dpr = 1;
  private readonly sprites = new SpriteCache();
  private readonly rayCos = Float32Array.from({ length: RAYS }, (_, i) => Math.cos((i / RAYS) * Math.PI * 2));
  private readonly raySin = Float32Array.from({ length: RAYS }, (_, i) => Math.sin((i / RAYS) * Math.PI * 2));
  private readonly rayLen = new Float32Array(RAYS);
  private rayFrom = { x: NaN, y: NaN, r: NaN };
  /** Screen pixels per tile. */
  ppt = 48;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
    this.map = renderMap();
    this.fog = document.createElement('canvas');
    this.fogCtx = this.fog.getContext('2d')!;
  }

  resize(cssW: number, cssH: number): void {
    // Touch devices get a lower cap: phones have 3x screens but small GPUs.
    const coarse = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
    this.dpr = Math.min(coarse ? 1.5 : 2, window.devicePixelRatio || 1);
    this.w = Math.max(1, Math.floor(cssW * this.dpr));
    this.h = Math.max(1, Math.floor(cssH * this.dpr));
    this.canvas.width = this.w;
    this.canvas.height = this.h;
    this.canvas.style.width = `${cssW}px`;
    this.canvas.style.height = `${cssH}px`;
    this.fog.width = Math.max(1, Math.ceil(this.w * FOG_SCALE));
    this.fog.height = Math.max(1, Math.ceil(this.h * FOG_SCALE));
    // About 10 tiles across the short side: the vision circle fills a phone screen.
    this.ppt = Math.max(30 * this.dpr, Math.min(64 * this.dpr, Math.min(this.w, this.h) / 10));
    this.sprites.setSize(this.ppt * 0.95);
  }

  draw(v: RenderView): void {
    const { ctx, w, h, ppt } = this;
    if (!w || !h) return;
    const k = ppt / TS;
    // Camera clamped so we never show far beyond the station.
    const halfW = w / 2 / ppt;
    const halfH = h / 2 / ppt;
    const camX = Math.min(Math.max(v.cx, halfW - 2), INF_COLS - halfW + 2);
    const camY = Math.min(Math.max(v.cy, halfH - 2), INF_ROWS - halfH + 2);
    const ox = w / 2 - camX * ppt;
    const oy = h / 2 - camY * ppt;
    const sx = (x: number) => ox + x * ppt;
    const sy = (y: number) => oy + y * ppt;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#020b16';
    ctx.fillRect(0, 0, w, h);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.map, -ox / k, -oy / k, w / k, h / k, 0, 0, w, h);

    // Emergency button (pulsing).
    const pulse = 0.5 + Math.sin(v.t * 4) * 0.5;
    ctx.fillStyle = '#7f1d1d';
    ctx.beginPath();
    ctx.ellipse(sx(INF_BUTTON.x), sy(INF_BUTTON.y) + ppt * 0.06, ppt * 0.32, ppt * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgb(${220 + pulse * 35},${38 + pulse * 30},${38})`;
    ctx.beginPath();
    ctx.ellipse(sx(INF_BUTTON.x), sy(INF_BUTTON.y) - ppt * 0.02, ppt * 0.26, ppt * 0.16, 0, 0, Math.PI * 2);
    ctx.fill();

    // Interaction marks.
    for (const m of v.marks) {
      ctx.strokeStyle = m.color;
      ctx.lineWidth = Math.max(2, ppt * 0.06);
      ctx.globalAlpha = 0.45 + pulse * 0.55;
      ctx.beginPath();
      ctx.arc(sx(m.x), sy(m.y), ppt * (0.5 + pulse * 0.08), 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // Bodies under the living, everybody sorted by depth. All blits from the sprite cache.
    const sp = this.sprites;
    const S = sp.s;
    const ax = S * SpriteCache.AX;
    const ay = S * SpriteCache.AY;
    for (const b of v.bodies) {
      const bx = sx(b.x);
      const by = sy(b.y) + S * 0.15;
      ctx.drawImage(sp.body(b.color), Math.round(bx - ax), Math.round(by - ay));
      // Three bubbles rising from the cracked dome.
      ctx.strokeStyle = 'rgba(190,240,255,0.7)';
      ctx.lineWidth = Math.max(1, S * 0.03);
      for (let i = 0; i < 3; i++) {
        const p = (v.t * 0.6 + i / 3) % 1;
        ctx.globalAlpha = 1 - p;
        ctx.beginPath();
        ctx.arc(bx - S * 0.3 + Math.sin((v.t + i) * 3) * S * 0.06, by - S * 0.2 - p * S * 0.7, S * (0.03 + i * 0.012), 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    const divers = v.me ? [...v.others, v.me] : [...v.others];
    divers.sort((a, b) => a.y - b.y);
    for (const d of divers) {
      const img = sp.diver(d.color, d.ghost, SpriteCache.frameAt(v.t + d.seat * 0.37, d.moving));
      const dx = sx(d.x);
      const dy = sy(d.y) - ppt * 0.12;
      if (d.ghost) ctx.globalAlpha = 0.5;
      if (d.facing === 1) ctx.drawImage(img, Math.round(dx - ax), Math.round(dy - ay));
      else {
        ctx.save();
        ctx.translate(Math.round(dx), 0);
        ctx.scale(-1, 1);
        ctx.drawImage(img, Math.round(-ax), Math.round(dy - ay));
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    }

    // Fog of war at a quarter of the resolution, cut by the walls.
    if (v.vision !== null && v.me) {
      const fc = this.fogCtx;
      const fw = this.fog.width;
      const fh = this.fog.height;
      fc.globalCompositeOperation = 'source-over';
      fc.clearRect(0, 0, fw, fh);
      fc.fillStyle = FOG;
      fc.fillRect(0, 0, fw, fh);
      fc.globalCompositeOperation = 'destination-out';
      const mx = sx(v.me.x) * FOG_SCALE;
      const my = sy(v.me.y) * FOG_SCALE;
      const r = v.vision * ppt * FOG_SCALE;
      const g = fc.createRadialGradient(mx, my, r * 0.55, mx, my, r);
      g.addColorStop(0, 'rgba(0,0,0,1)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      fc.fillStyle = g;
      // Rays are only cast again when I moved (standing still costs nothing).
      const rf = this.rayFrom;
      if (Math.abs(rf.x - v.me.x) > 0.01 || Math.abs(rf.y - v.me.y) > 0.01 || rf.r !== v.vision) {
        for (let i = 0; i < RAYS; i++) {
          // A bit past the wall face so the walls themselves are lit.
          this.rayLen[i] = Math.min(v.vision, infRayLength(v.me.x, v.me.y, (i / RAYS) * Math.PI * 2, v.vision) + 0.45);
        }
        this.rayFrom = { x: v.me.x, y: v.me.y, r: v.vision };
      }
      const pk = ppt * FOG_SCALE;
      fc.beginPath();
      for (let i = 0; i < RAYS; i++) {
        const px = mx + this.rayCos[i] * this.rayLen[i] * pk;
        const py = my + this.raySin[i] * this.rayLen[i] * pk;
        if (i === 0) fc.moveTo(px, py);
        else fc.lineTo(px, py);
      }
      fc.closePath();
      fc.fill();
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(this.fog, 0, 0, fw, fh, 0, 0, w, h);
    }

    // Name tags on top of the fog (pre-rendered per name).
    const px = Math.round(Math.max(11 * this.dpr, ppt * 0.26));
    const outline = Math.max(2, Math.round(ppt * 0.07));
    for (const d of divers) {
      const tag = sp.label(d.name, d.mate ? '#f87171' : '#f8fafc', px, outline);
      if (d.ghost) ctx.globalAlpha = 0.6;
      ctx.drawImage(tag, Math.round(sx(d.x) - tag.width / 2), Math.round(sy(d.y) - ppt * 0.78 - px * 0.55 - tag.height / 2));
      ctx.globalAlpha = 1;
    }

    if (v.critical) {
      ctx.fillStyle = `rgba(220,38,38,${0.04 + pulse * 0.1})`;
      ctx.fillRect(0, 0, w, h);
    }

    // Arrows at the screen edge pointing to off-screen targets.
    for (const a of v.arrows) {
      const tx = sx(a.x);
      const ty = sy(a.y);
      if (tx > 0 && ty > 0 && tx < w && ty < h) continue;
      const ang = Math.atan2(ty - h / 2, tx - w / 2);
      const pad = 34 * this.dpr;
      const ex = w / 2 + Math.cos(ang) * (w / 2 - pad);
      const ey = h / 2 + Math.sin(ang) * (h / 2 - pad);
      ctx.save();
      ctx.translate(ex, ey);
      ctx.rotate(ang);
      ctx.fillStyle = a.color;
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2 * this.dpr;
      const s = 14 * this.dpr;
      ctx.beginPath();
      ctx.moveTo(s, 0);
      ctx.lineTo(-s * 0.7, -s * 0.75);
      ctx.lineTo(-s * 0.3, 0);
      ctx.lineTo(-s * 0.7, s * 0.75);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }
}

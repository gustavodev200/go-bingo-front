import { INF_BUTTON, INF_COLS, INF_ROWS, infRayLength } from '@/contracts';
import { renderMap, TS } from './map-art';
import { drawBody, drawDiver } from './sprites';

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

const RAYS = 200;
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
  /** Screen pixels per tile. */
  ppt = 48;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
    this.map = renderMap();
    this.fog = document.createElement('canvas');
    this.fogCtx = this.fog.getContext('2d')!;
  }

  resize(cssW: number, cssH: number): void {
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = Math.max(1, Math.floor(cssW * this.dpr));
    this.h = Math.max(1, Math.floor(cssH * this.dpr));
    this.canvas.width = this.w;
    this.canvas.height = this.h;
    this.canvas.style.width = `${cssW}px`;
    this.canvas.style.height = `${cssH}px`;
    this.fog.width = this.w;
    this.fog.height = this.h;
    // About 10 tiles across the short side: the vision circle fills a phone screen.
    this.ppt = Math.max(30 * this.dpr, Math.min(64 * this.dpr, Math.min(this.w, this.h) / 10));
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

    // Bodies under the living, everybody sorted by depth.
    for (const b of v.bodies) drawBody(ctx, sx(b.x), sy(b.y), ppt * 0.95, b.color, v.t);
    const divers = [...v.others];
    if (v.me) divers.push(v.me);
    divers.sort((a, b) => a.y - b.y);
    for (const d of divers) drawDiver(ctx, sx(d.x), sy(d.y) - ppt * 0.12, ppt * 0.95, { color: d.color, facing: d.facing, t: v.t + d.seat, moving: d.moving, ghost: d.ghost });

    // Fog of war.
    if (v.vision !== null && v.me) {
      const fc = this.fogCtx;
      fc.globalCompositeOperation = 'source-over';
      fc.clearRect(0, 0, w, h);
      fc.fillStyle = FOG;
      fc.fillRect(0, 0, w, h);
      fc.globalCompositeOperation = 'destination-out';
      const mx = sx(v.me.x);
      const my = sy(v.me.y);
      const r = v.vision * ppt;
      const g = fc.createRadialGradient(mx, my, r * 0.55, mx, my, r);
      g.addColorStop(0, 'rgba(0,0,0,1)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      fc.fillStyle = g;
      fc.beginPath();
      for (let i = 0; i < RAYS; i++) {
        const a = (i / RAYS) * Math.PI * 2;
        // A bit past the wall face so the walls themselves are lit.
        const len = Math.min(v.vision, infRayLength(v.me.x, v.me.y, a, v.vision) + 0.45);
        const px = mx + Math.cos(a) * len * ppt;
        const py = my + Math.sin(a) * len * ppt;
        if (i === 0) fc.moveTo(px, py);
        else fc.lineTo(px, py);
      }
      fc.closePath();
      fc.fill();
      ctx.drawImage(this.fog, 0, 0);
    }

    // Names on top of the fog (only for who is visible anyway).
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.font = `700 ${Math.round(Math.max(11 * this.dpr, ppt * 0.26))}px system-ui, sans-serif`;
    ctx.lineWidth = Math.max(2, ppt * 0.07);
    ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    for (const d of divers) {
      const x = sx(d.x);
      const y = sy(d.y) - ppt * 0.78;
      ctx.globalAlpha = d.ghost ? 0.6 : 1;
      ctx.strokeText(d.name, x, y);
      ctx.fillStyle = d.mate ? '#f87171' : '#f8fafc';
      ctx.fillText(d.name, x, y);
    }
    ctx.globalAlpha = 1;

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

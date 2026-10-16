import { BOMBER_COLORS, BOMBER_COLS, BOMBER_ROWS, BOMBER_TILE } from '@/contracts';
import type { ArenaView, RenderBomb, RenderPlayer } from '../view';
import { drawFlame, sprites, TS } from './sprites';

export const ARENA_W = BOMBER_COLS * TS;
export const ARENA_H = BOMBER_ROWS * TS;

const isBlock = (c: string | undefined) => c === BOMBER_TILE.HARD || c === BOMBER_TILE.SOFT || c === BOMBER_TILE.BURNING;
const DEATH_SECONDS = 1.2;

/** Draws the arena on a canvas: pixel-art tiles scaled with crisp edges. */
export class ArenaRenderer {
  private readonly g: CanvasRenderingContext2D;
  private scale = 1;
  private readonly deaths = new Map<number, number>();
  shake = 0;

  constructor(private readonly cv: HTMLCanvasElement) {
    this.g = cv.getContext('2d')!;
  }

  /** Fits the arena inside the box, keeping its aspect ratio. */
  resize(boxW: number, boxH: number): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    let s = Math.max(0.5, Math.min(boxW / ARENA_W, boxH / ARENA_H));
    if (s >= 2) s = Math.floor(s * 2) / 2;
    const cssW = Math.floor(ARENA_W * s);
    const cssH = Math.floor(ARENA_H * s);
    this.cv.style.width = `${cssW}px`;
    this.cv.style.height = `${cssH}px`;
    this.cv.width = Math.round(cssW * dpr);
    this.cv.height = Math.round(cssH * dpr);
    this.scale = this.cv.width / ARENA_W;
  }

  resetDeaths(): void {
    this.deaths.clear();
  }

  draw(v: ArenaView, nowMs: number): void {
    const g = this.g;
    const t = nowMs / 1000;
    const sp = sprites();
    g.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    g.imageSmoothingEnabled = false;
    if (this.shake > 0) {
      g.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);
      this.shake = Math.max(0, this.shake - 0.4);
    }

    for (let y = 0; y < BOMBER_ROWS; y++)
      for (let x = 0; x < BOMBER_COLS; x++) {
        const c = v.grid[y * BOMBER_COLS + x];
        const px = x * TS;
        const py = y * TS;
        if (c === BOMBER_TILE.HARD) {
          g.drawImage(sp.hard, px, py);
          continue;
        }
        g.drawImage(isBlock(y > 0 ? v.grid[(y - 1) * BOMBER_COLS + x] : '#') ? sp.floorShadow : sp.floor, px, py);
        if (c === BOMBER_TILE.SOFT) g.drawImage(sp.soft, px, py);
        else if (c === BOMBER_TILE.BURNING) {
          g.globalAlpha = 0.6 + 0.4 * Math.sin(t * 30 + x);
          g.drawImage(sp.burning, px, py);
          g.globalAlpha = 1;
        } else if (sp.items[c]) {
          g.drawImage(sp.items[c], px, py);
          if (Math.floor(t * 4) % 2) {
            g.fillStyle = 'rgba(255,255,255,.12)';
            g.fillRect(px + 1, py + 1, 14, 14);
          }
        }
      }

    for (const [k, kind, life] of v.flames) drawFlame(g, (k % BOMBER_COLS) * TS, Math.floor(k / BOMBER_COLS) * TS, kind, life, t);

    for (const b of v.bombs) if (b.heldBy < 0 && !b.fly) this.drawBomb(b, b.x * TS, b.y * TS, t);

    for (const p of [...v.players].sort((a, b) => a.y - b.y)) this.drawPlayer(p, v, nowMs);

    for (const b of v.bombs) {
      if (b.fly) {
        const [fx, fy, tx, ty, prog] = b.fly;
        const x = fx + (tx - fx) * prog;
        const y = fy + (ty - fy) * prog;
        const arc = Math.sin(prog * Math.PI) * (Math.hypot(tx - fx, ty - fy) > 1.5 ? 18 : 6);
        g.fillStyle = 'rgba(0,0,0,.25)';
        g.beginPath();
        g.ellipse(x * TS + 8, y * TS + 13, 5, 2, 0, 0, Math.PI * 2);
        g.fill();
        this.drawBomb(b, x * TS, y * TS - arc, t);
      } else if (b.heldBy >= 0) {
        const h = v.players.find((p) => p.seat === b.heldBy);
        if (h) this.drawBomb(b, h.x * TS, h.y * TS - 15, t);
      }
    }

    for (const [x, y, prog] of v.drops) {
      g.fillStyle = `rgba(0,0,0,${0.15 + prog * 0.35})`;
      g.fillRect(x * TS + 2, y * TS + 2, 12 * (0.4 + prog * 0.6), 12 * (0.4 + prog * 0.6));
      g.drawImage(sp.hard, x * TS, y * TS - (1 - prog) * 120);
    }

    if (v.hurry) {
      g.strokeStyle = `rgba(255,40,40,${0.35 + 0.35 * Math.sin(t * 8)})`;
      g.lineWidth = 3;
      g.strokeRect(1.5, 1.5, ARENA_W - 3, ARENA_H - 3);
    }
  }

  private drawBomb(b: RenderBomb, px: number, py: number, t: number): void {
    const g = this.g;
    const sp = sprites();
    const urgency = b.remote ? 0.4 : 1 - b.fuse;
    const pulse = 1 + Math.sin(t * (5 + urgency * 14)) * (0.06 + urgency * 0.06);
    const size = 16 * pulse;
    const off = (size - 16) / 2;
    g.drawImage(b.remote ? sp.bombRemote : sp.bomb, px - off, py - off, size, size);
    g.fillStyle = Math.floor(t * 20) % 2 ? '#fff060' : '#ff6020';
    g.fillRect(px + 10, py + 1, 3, 2);
    g.fillRect(px + 11, py, 1, 4);
    if (b.remote) {
      g.fillStyle = Math.floor(t * 3) % 2 ? '#ff3050' : '#ffd0d8';
      g.fillRect(px + 7, py + 9, 2, 2);
    }
  }

  private drawPlayer(p: RenderPlayer, v: ArenaView, nowMs: number): void {
    const g = this.g;
    const t = nowMs / 1000;
    const frames = sprites().bombers[p.color] ?? sprites().bombers[0];
    const px = Math.round(p.x * TS * 4) / 4;
    const py = Math.round(p.y * TS * 4) / 4 - 6;

    if (!p.alive) {
      if (!this.deaths.has(p.seat)) this.deaths.set(p.seat, nowMs);
      const dt = (nowMs - this.deaths.get(p.seat)!) / 1000;
      if (dt > DEATH_SECONDS) return;
      const k = Math.max(0, 1 - dt / DEATH_SECONDS);
      g.save();
      g.translate(px + 8, py + 18);
      g.scale(k, k * (1 + Math.sin(dt * 30) * 0.2));
      g.globalAlpha = Math.floor(dt * 16) % 2 ? 0.4 : 1;
      g.drawImage(frames[[2, 3, 1, 4][Math.floor(dt * 10) % 4]][0], -8, -18);
      g.restore();
      return;
    }
    this.deaths.delete(p.seat);

    const frame = p.moving ? 1 + (Math.floor(t * 9) % 3) : 0;
    if (p.curse && Math.floor(t * 12) % 2) g.globalAlpha = 0.45;
    g.drawImage(frames[p.dir || 2][frame], px, py);
    g.globalAlpha = 1;
    if (p.curse) {
      g.fillStyle = Math.floor(t * 6) % 2 ? '#a020f0' : '#40ff80';
      g.fillRect(px + 7, py - 3, 2, 2);
    }
    if (p.seat === v.mySeat && v.introLeft > 0) {
      const bob = Math.sin(t * 8) * 1.5;
      g.fillStyle = BOMBER_COLORS[p.color]?.helmet ?? '#fff';
      g.strokeStyle = '#000';
      g.lineWidth = 0.75;
      g.beginPath();
      g.moveTo(px + 4, py - 9 + bob);
      g.lineTo(px + 12, py - 9 + bob);
      g.lineTo(px + 8, py - 4 + bob);
      g.closePath();
      g.fill();
      g.stroke();
    }
  }
}

import { TACADA_BALL_R, TACADA_KITCHEN_X, TACADA_POCKETS, TACADA_TABLE_H, TACADA_TABLE_W, type TacadaBallPos } from '@/contracts';

/** Wood + cushion around the cloth, in table units. */
export const RAIL = 10;
export const WORLD_W = TACADA_TABLE_W + 2 * RAIL;
export const WORLD_H = TACADA_TABLE_H + 2 * RAIL;

export const BALL_COLORS: Record<number, string> = {
  1: '#f6c400',
  2: '#1d4ed8',
  3: '#dc2626',
  4: '#6d28d9',
  5: '#f97316',
  6: '#15803d',
  7: '#7f1d1d',
  8: '#111111',
};
export const ballColor = (n: number) => BALL_COLORS[n > 8 ? n - 8 : n] ?? '#f8fafc';

/** Maps table units to canvas pixels (backing store, already multiplied by the device pixel ratio). */
export interface View {
  scale: number;
  /** Backing pixels per CSS pixel. */
  dpr: number;
  width: number;
  height: number;
}

export const toPx = (v: View, x: number) => (x + RAIL) * v.scale;

const R = TACADA_BALL_R;

function canvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}

/** Cloth, rails, pockets and markings: drawn once per resize, then blitted every frame. */
export function drawStatic(v: View): HTMLCanvasElement {
  const c = canvas(v.width, v.height);
  const g = c.getContext('2d')!;
  const s = v.scale;
  const px = (x: number) => (x + RAIL) * s;

  // Rails: dark lacquered wood with a soft top light.
  const wood = g.createLinearGradient(0, 0, 0, v.height);
  wood.addColorStop(0, '#5b2a12');
  wood.addColorStop(0.5, '#3b1a0a');
  wood.addColorStop(1, '#2a1206');
  g.fillStyle = wood;
  roundRect(g, 0, 0, v.width, v.height, RAIL * s * 0.9);
  g.fill();
  g.strokeStyle = 'rgba(255,220,170,0.18)';
  g.lineWidth = Math.max(1, s * 0.5);
  roundRect(g, s * 0.6, s * 0.6, v.width - s * 1.2, v.height - s * 1.2, RAIL * s * 0.75);
  g.stroke();

  // Cushions (slightly darker cloth band) and the playing surface.
  const cushion = RAIL * 0.42;
  g.fillStyle = '#0b5a43';
  g.fillRect(px(-cushion), px(-cushion), (TACADA_TABLE_W + 2 * cushion) * s, (TACADA_TABLE_H + 2 * cushion) * s);
  const cloth = g.createRadialGradient(px(TACADA_TABLE_W / 2), px(TACADA_TABLE_H / 2), s * 10, px(TACADA_TABLE_W / 2), px(TACADA_TABLE_H / 2), s * TACADA_TABLE_W * 0.62);
  cloth.addColorStop(0, '#17a578');
  cloth.addColorStop(0.65, '#0f8461');
  cloth.addColorStop(1, '#0a6249');
  g.fillStyle = cloth;
  g.fillRect(px(0), px(0), TACADA_TABLE_W * s, TACADA_TABLE_H * s);

  // Cloth grain (very subtle noise) for texture without per-frame cost.
  g.globalAlpha = 0.05;
  for (let i = 0; i < 900; i++) {
    g.fillStyle = i % 2 ? '#ffffff' : '#000000';
    g.fillRect(px(Math.random() * TACADA_TABLE_W), px(Math.random() * TACADA_TABLE_H), s * 0.5, s * 0.5);
  }
  g.globalAlpha = 1;

  // Head string and foot spot.
  g.strokeStyle = 'rgba(255,255,255,0.16)';
  g.lineWidth = Math.max(1, s * 0.3);
  g.beginPath();
  g.moveTo(px(TACADA_KITCHEN_X), px(0));
  g.lineTo(px(TACADA_KITCHEN_X), px(TACADA_TABLE_H));
  g.stroke();
  g.fillStyle = 'rgba(255,255,255,0.28)';
  g.beginPath();
  g.arc(px(150), px(50), s * 0.6, 0, Math.PI * 2);
  g.fill();

  // Diamonds on the rails.
  g.fillStyle = '#f3d79a';
  const dRail = -RAIL * 0.72;
  for (let i = 1; i < 8; i++) {
    if (i === 4) continue;
    const x = (TACADA_TABLE_W / 8) * i;
    diamond(g, px(x), px(dRail), s);
    diamond(g, px(x), px(TACADA_TABLE_H - dRail), s);
  }
  for (let i = 1; i < 4; i++) {
    const y = (TACADA_TABLE_H / 4) * i;
    diamond(g, px(dRail), px(y), s);
    diamond(g, px(TACADA_TABLE_W - dRail), px(y), s);
  }

  // Pockets: a dark hole with a leather rim.
  for (const p of TACADA_POCKETS) {
    const r = p.r * 1.12;
    g.fillStyle = '#1b0d05';
    g.beginPath();
    g.arc(px(p.x), px(p.y), (r + 1.3) * s, 0, Math.PI * 2);
    g.fill();
    const hole = g.createRadialGradient(px(p.x), px(p.y), 0, px(p.x), px(p.y), r * s);
    hole.addColorStop(0, '#000');
    hole.addColorStop(0.75, '#050302');
    hole.addColorStop(1, '#2a1a10');
    g.fillStyle = hole;
    g.beginPath();
    g.arc(px(p.x), px(p.y), r * s, 0, Math.PI * 2);
    g.fill();
  }
  return c;
}

function diamond(g: CanvasRenderingContext2D, x: number, y: number, s: number) {
  const d = s * 0.75;
  g.beginPath();
  g.moveTo(x, y - d);
  g.lineTo(x + d * 0.6, y);
  g.lineTo(x, y + d);
  g.lineTo(x - d * 0.6, y);
  g.closePath();
  g.fill();
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

/** One sprite per ball (and one shadow), sized for the current scale. */
export function ballSprites(v: View): { balls: HTMLCanvasElement[]; shadow: HTMLCanvasElement; size: number } {
  const rp = R * v.scale;
  const size = Math.ceil(rp * 2 + 2);
  const c = size / 2;
  const balls: HTMLCanvasElement[] = [];
  for (let n = 0; n < 16; n++) {
    const sprite = canvas(size, size);
    const g = sprite.getContext('2d')!;
    g.save();
    g.beginPath();
    g.arc(c, c, rp, 0, Math.PI * 2);
    g.clip();
    const color = ballColor(n);
    if (n === 0) g.fillStyle = '#fbfaf3';
    else if (n > 8) g.fillStyle = '#f8f6ee';
    else g.fillStyle = color;
    g.fillRect(0, 0, size, size);
    if (n > 8) {
      g.fillStyle = color;
      g.fillRect(0, c - rp * 0.56, size, rp * 1.12);
    }
    if (n > 0) {
      g.fillStyle = '#fffdf5';
      g.beginPath();
      g.arc(c, c, rp * 0.46, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#111';
      g.font = `800 ${Math.max(6, rp * (n > 9 ? 0.56 : 0.66))}px ui-sans-serif, system-ui, sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(String(n), c, c + rp * 0.04);
    } else {
      // The cue ball keeps a small red dot, like a measle ball, so spin reads on screen.
      g.fillStyle = 'rgba(220,38,38,0.55)';
      g.beginPath();
      g.arc(c + rp * 0.35, c - rp * 0.3, rp * 0.14, 0, Math.PI * 2);
      g.fill();
    }
    const shade = g.createRadialGradient(c - rp * 0.38, c - rp * 0.42, rp * 0.05, c, c, rp * 1.05);
    shade.addColorStop(0, 'rgba(255,255,255,0.75)');
    shade.addColorStop(0.18, 'rgba(255,255,255,0.18)');
    shade.addColorStop(0.55, 'rgba(0,0,0,0)');
    shade.addColorStop(1, 'rgba(0,0,0,0.5)');
    g.fillStyle = shade;
    g.fillRect(0, 0, size, size);
    g.restore();
    balls.push(sprite);
  }
  const shadow = canvas(size * 1.4, size * 1.4);
  const sg = shadow.getContext('2d')!;
  const sc = (size * 1.4) / 2;
  const grad = sg.createRadialGradient(sc, sc, rp * 0.4, sc, sc, rp * 1.3);
  grad.addColorStop(0, 'rgba(0,0,0,0.45)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  sg.fillStyle = grad;
  sg.fillRect(0, 0, shadow.width, shadow.height);
  return { balls, shadow, size };
}

export interface Overlay {
  /** Aim from the cue ball (unit vector) and power 0–1 (pulls the cue back). */
  aim: { dirX: number; dirY: number; power: number } | null;
  guide: {
    x: number;
    y: number;
    ball: number | null;
    objDirX: number;
    objDirY: number;
    cueDirX: number;
    cueDirY: number;
    legal: boolean;
  } | null;
  /** Show where the hit ball goes (long guide). */
  longGuide: boolean;
  /** Cue ball being placed (ball in hand) and whether the spot is valid. */
  placing: { valid: boolean } | null;
  /** Pocket chosen for the 8, and whether pockets are clickable now. */
  pocket: number | null;
  choosingPocket: boolean;
  /** Seconds since mount, for pulsing highlights. */
  t: number;
}

/** Draws one frame: static layer, balls, then the aim and the cue on top. */
export function drawFrame(g: CanvasRenderingContext2D, v: View, base: HTMLCanvasElement, sprites: ReturnType<typeof ballSprites>, balls: readonly TacadaBallPos[], o: Overlay): void {
  const s = v.scale;
  const px = (x: number) => (x + RAIL) * s;
  g.drawImage(base, 0, 0);

  if (o.choosingPocket || o.pocket !== null) {
    TACADA_POCKETS.forEach((p, i) => {
      const chosen = o.pocket === i;
      if (!chosen && !o.choosingPocket) return;
      g.strokeStyle = chosen ? '#fde047' : `rgba(253,224,71,${0.35 + 0.25 * Math.sin(o.t * 5)})`;
      g.lineWidth = s * (chosen ? 1.1 : 0.6);
      g.beginPath();
      g.arc(px(p.x), px(p.y), (p.r + 2.2) * s, 0, Math.PI * 2);
      g.stroke();
    });
  }

  const half = sprites.size / 2;
  const sh = sprites.shadow.width / 2;
  for (let i = 0; i < balls.length; i++) {
    const b = balls[i];
    if (b) g.drawImage(sprites.shadow, px(b[0]) - sh + s * 0.7, px(b[1]) - sh + s * 0.9);
  }
  for (let i = balls.length - 1; i >= 0; i--) {
    const b = balls[i];
    if (!b) continue;
    if (i === 0 && o.placing) g.globalAlpha = o.placing.valid ? 0.95 : 0.5;
    g.drawImage(sprites.balls[i], px(b[0]) - half, px(b[1]) - half);
    g.globalAlpha = 1;
  }

  const cue = balls[0];
  if (cue && o.placing) {
    g.strokeStyle = o.placing.valid ? 'rgba(255,255,255,0.85)' : 'rgba(244,63,94,0.95)';
    g.lineWidth = s * 0.35;
    g.setLineDash([s * 1.2, s * 0.9]);
    g.beginPath();
    g.arc(px(cue[0]), px(cue[1]), (R + 1.6) * s, 0, Math.PI * 2);
    g.stroke();
    g.setLineDash([]);
  }

  if (cue && o.aim && o.guide) {
    const gd = o.guide;
    g.strokeStyle = 'rgba(255,255,255,0.85)';
    g.lineWidth = Math.max(1, s * 0.28);
    g.setLineDash([s * 1.4, s * 1]);
    g.beginPath();
    g.moveTo(px(cue[0]), px(cue[1]));
    g.lineTo(px(gd.x), px(gd.y));
    g.stroke();
    g.setLineDash([]);
    g.strokeStyle = gd.legal ? 'rgba(255,255,255,0.9)' : 'rgba(244,63,94,0.95)';
    g.lineWidth = Math.max(1, s * 0.3);
    g.beginPath();
    g.arc(px(gd.x), px(gd.y), R * s, 0, Math.PI * 2);
    g.stroke();
    if (!gd.legal) {
      const d = R * 0.6 * s;
      g.beginPath();
      g.moveTo(px(gd.x) - d, px(gd.y) - d);
      g.lineTo(px(gd.x) + d, px(gd.y) + d);
      g.moveTo(px(gd.x) + d, px(gd.y) - d);
      g.lineTo(px(gd.x) - d, px(gd.y) + d);
      g.stroke();
    } else if (gd.ball !== null && o.longGuide) {
      const target = balls[gd.ball];
      if (target) {
        g.strokeStyle = 'rgba(255,255,255,0.75)';
        g.beginPath();
        g.moveTo(px(target[0]), px(target[1]));
        g.lineTo(px(target[0] + gd.objDirX * 30), px(target[1] + gd.objDirY * 30));
        g.stroke();
        g.strokeStyle = 'rgba(255,255,255,0.35)';
        g.beginPath();
        g.moveTo(px(gd.x), px(gd.y));
        g.lineTo(px(gd.x + gd.cueDirX * 12), px(gd.y + gd.cueDirY * 12));
        g.stroke();
      }
    }
  }

  if (cue && o.aim) drawCue(g, px(cue[0]), px(cue[1]), o.aim.dirX, o.aim.dirY, o.aim.power, s);
}

/** The cue stick behind the cue ball, pulled back with the power. */
function drawCue(g: CanvasRenderingContext2D, cx: number, cy: number, dx: number, dy: number, power: number, s: number) {
  const angle = Math.atan2(dy, dx);
  g.save();
  g.translate(cx, cy);
  g.rotate(angle);
  const start = (R + 1.2 + power * 14) * s;
  const len = 120 * s;
  const tip = 0.55 * s;
  const butt = 1.45 * s;
  g.shadowColor = 'rgba(0,0,0,0.45)';
  g.shadowBlur = 4 * s;
  g.shadowOffsetY = 2 * s;
  const shaft = g.createLinearGradient(-start, 0, -start - len, 0);
  shaft.addColorStop(0, '#f5e6c8');
  shaft.addColorStop(0.55, '#d9b27a');
  shaft.addColorStop(0.62, '#2b1408');
  shaft.addColorStop(0.7, '#7c2d12');
  shaft.addColorStop(1, '#1c0b04');
  g.fillStyle = shaft;
  g.beginPath();
  g.moveTo(-start, -tip);
  g.lineTo(-start - len, -butt);
  g.lineTo(-start - len, butt);
  g.lineTo(-start, tip);
  g.closePath();
  g.fill();
  g.shadowColor = 'transparent';
  // Chalked tip and ferrule.
  g.fillStyle = '#2563eb';
  g.fillRect(-start - 0.6 * s, -tip, 0.6 * s, tip * 2);
  g.fillStyle = '#fafaf9';
  g.fillRect(-start - 2.2 * s, -tip * 1.05, 1.6 * s, tip * 2.1);
  // Gold ring at the joint.
  g.fillStyle = '#eab308';
  g.fillRect(-start - len * 0.6, -butt * 0.85, 0.9 * s, butt * 1.7);
  g.restore();
}

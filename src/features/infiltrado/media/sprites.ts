import { INF_COLORS } from '@/contracts';

export interface DiverLook {
  color: number;
  facing: -1 | 1;
  /** Seconds, for the walk cycle and idle bob. */
  t: number;
  moving: boolean;
  ghost?: boolean;
}

const BRASS = '#d9a441';
const BRASS_DARK = '#8a5a12';
const OUTLINE = '#0b1220';

const colorOf = (i: number) => INF_COLORS[i] ?? INF_COLORS[0];

/**
 * The Abissal diver: an egg-shaped body with an air tank on the back, a glass
 * dome helmet on a brass collar and a little lamp on top. (cx, cy) is the
 * center of the body; `s` is the full height in pixels.
 */
export function drawDiver(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number, look: DiverLook): void {
  const c = colorOf(look.color);
  const f = look.facing;
  const bob = look.moving ? Math.abs(Math.sin(look.t * 11)) * s * 0.04 : Math.sin(look.t * 2.2) * s * 0.012;
  ctx.save();
  ctx.translate(cx, cy - bob);
  if (look.ghost) ctx.globalAlpha *= 0.5;
  ctx.lineWidth = Math.max(1.5, s * 0.045);
  ctx.strokeStyle = OUTLINE;
  ctx.lineJoin = 'round';

  // Shadow on the floor.
  if (!look.ghost) {
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath();
    ctx.ellipse(0, s * 0.42 + bob, s * 0.3, s * 0.08, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Legs (walk cycle) or a ghostly tail.
  if (look.ghost) {
    ctx.fillStyle = c.body;
    ctx.beginPath();
    ctx.moveTo(-s * 0.3, s * 0.1);
    for (let i = 0; i <= 6; i++) {
      const x = -s * 0.3 + (i / 6) * s * 0.6;
      ctx.lineTo(x, s * 0.36 + Math.sin(look.t * 6 + i * 1.7) * s * 0.05);
    }
    ctx.lineTo(s * 0.3, s * 0.1);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else {
    const swing = look.moving ? Math.sin(look.t * 11) * s * 0.07 : 0;
    ctx.fillStyle = c.shade;
    for (const [lx, off] of [
      [-0.14, swing],
      [0.14, -swing],
    ]) {
      ctx.beginPath();
      ctx.roundRect(lx * s - s * 0.08 + off * 0.3, s * 0.2 + Math.max(0, -off) * 0.4, s * 0.16, s * 0.2, s * 0.06);
      ctx.fill();
      ctx.stroke();
    }
  }

  // Air tank on the back.
  ctx.fillStyle = c.shade;
  ctx.beginPath();
  ctx.roundRect(-f * s * 0.42 - s * 0.1, -s * 0.12, s * 0.2, s * 0.36, s * 0.08);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = BRASS;
  ctx.fillRect(-f * s * 0.42 - s * 0.05, -s * 0.17, s * 0.1, s * 0.06);

  // Body.
  const g = ctx.createLinearGradient(-s * 0.3, -s * 0.2, s * 0.3, s * 0.3);
  g.addColorStop(0, c.body);
  g.addColorStop(1, c.shade);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(0, s * 0.06, s * 0.33, s * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Belt with a brass buckle.
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(-s * 0.32, s * 0.12, s * 0.64, s * 0.06);
  ctx.fillStyle = BRASS;
  ctx.fillRect(f * s * 0.08 - s * 0.04, s * 0.11, s * 0.08, s * 0.08);

  // Brass collar.
  ctx.fillStyle = BRASS;
  ctx.beginPath();
  ctx.ellipse(f * s * 0.03, -s * 0.2, s * 0.25, s * 0.07, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = BRASS_DARK;
  ctx.stroke();
  ctx.strokeStyle = OUTLINE;

  // Glass dome with the face inside.
  const hx = f * s * 0.03;
  const hy = -s * 0.36;
  const hr = s * 0.22;
  ctx.fillStyle = 'rgba(14,40,64,0.85)';
  ctx.beginPath();
  ctx.arc(hx, hy, hr, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = c.body;
  ctx.globalAlpha *= 0.35;
  ctx.beginPath();
  ctx.arc(hx + f * hr * 0.15, hy + hr * 0.2, hr * 0.7, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha /= 0.35;
  // Eyes looking where it goes (blinking now and then).
  const blink = look.t % 4.3 < 0.12;
  ctx.fillStyle = '#f8fafc';
  for (const ex of [-0.28, 0.32]) {
    ctx.beginPath();
    ctx.ellipse(hx + (ex + f * 0.22) * hr, hy + hr * 0.05, hr * 0.17, blink ? hr * 0.03 : hr * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  if (!blink) {
    ctx.fillStyle = OUTLINE;
    for (const ex of [-0.28, 0.32]) {
      ctx.beginPath();
      ctx.arc(hx + (ex + f * 0.3) * hr, hy + hr * 0.08, hr * 0.09, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Glass rim and shine.
  ctx.beginPath();
  ctx.arc(hx, hy, hr, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(190,240,255,0.9)';
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = Math.max(1.2, s * 0.03);
  ctx.beginPath();
  ctx.arc(hx, hy, hr * 0.72, Math.PI * 1.1, Math.PI * 1.45);
  ctx.stroke();

  // Lamp on top.
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = Math.max(1, s * 0.03);
  ctx.beginPath();
  ctx.moveTo(hx, hy - hr);
  ctx.lineTo(hx + f * s * 0.04, hy - hr - s * 0.1);
  ctx.stroke();
  // Lamp halo as a plain radial gradient: shadowBlur is very slow on phones.
  const lx = hx + f * s * 0.04;
  const ly = hy - hr - s * 0.12;
  const halo = ctx.createRadialGradient(lx, ly, 0, lx, ly, s * 0.16);
  halo.addColorStop(0, 'rgba(253,230,138,0.65)');
  halo.addColorStop(1, 'rgba(253,230,138,0)');
  ctx.fillStyle = halo;
  ctx.fillRect(lx - s * 0.16, ly - s * 0.16, s * 0.32, s * 0.32);
  ctx.fillStyle = '#fde68a';
  ctx.beginPath();
  ctx.arc(lx, ly, s * 0.05, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** A fallen diver: lying on its side, cracked dome, bubbles rising. */
export function drawBody(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number, color: number, t: number, bubbles = true): void {
  const c = colorOf(color);
  ctx.save();
  ctx.translate(cx, cy + s * 0.15);
  ctx.lineWidth = Math.max(1.5, s * 0.045);
  ctx.strokeStyle = OUTLINE;
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(0, s * 0.12, s * 0.48, s * 0.1, 0, 0, Math.PI * 2);
  ctx.fill();
  // Body on its side.
  ctx.fillStyle = c.body;
  ctx.beginPath();
  ctx.ellipse(s * 0.05, 0, s * 0.32, s * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = c.shade;
  ctx.beginPath();
  ctx.roundRect(s * 0.15, s * 0.04, s * 0.22, s * 0.12, s * 0.05);
  ctx.fill();
  ctx.stroke();
  // Dome, cracked.
  ctx.fillStyle = 'rgba(14,40,64,0.9)';
  ctx.beginPath();
  ctx.arc(-s * 0.3, -s * 0.02, s * 0.17, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(190,240,255,0.9)';
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-s * 0.36, -s * 0.16);
  ctx.lineTo(-s * 0.3, -s * 0.05);
  ctx.lineTo(-s * 0.37, 0);
  ctx.lineTo(-s * 0.28, s * 0.09);
  ctx.stroke();
  // X eyes.
  ctx.strokeStyle = '#f8fafc';
  ctx.lineWidth = Math.max(1, s * 0.03);
  for (const ex of [-0.38, -0.24]) {
    ctx.beginPath();
    ctx.moveTo(ex * s - s * 0.03, -s * 0.05);
    ctx.lineTo(ex * s + s * 0.03, s * 0.01);
    ctx.moveTo(ex * s + s * 0.03, -s * 0.05);
    ctx.lineTo(ex * s - s * 0.03, s * 0.01);
    ctx.stroke();
  }
  if (!bubbles) {
    ctx.restore();
    return;
  }
  // Bubbles.
  ctx.strokeStyle = 'rgba(190,240,255,0.7)';
  for (let i = 0; i < 3; i++) {
    const p = (t * 0.6 + i / 3) % 1;
    ctx.beginPath();
    ctx.arc(-s * 0.3 + Math.sin((t + i) * 3) * s * 0.06, -s * 0.2 - p * s * 0.7, s * (0.03 + i * 0.012), 0, Math.PI * 2);
    ctx.globalAlpha = 1 - p;
    ctx.stroke();
  }
  ctx.restore();
}

/** Idle diver for the lobby cards and HUD chips. */
export function drawPortrait(cv: HTMLCanvasElement, color: number, t: number, opts: { ghost?: boolean; dead?: boolean } = {}): void {
  const ctx = cv.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, cv.width, cv.height);
  const s = Math.min(cv.width, cv.height) * 0.78;
  if (opts.dead) drawBody(ctx, cv.width / 2, cv.height * 0.55, s, color, t);
  else drawDiver(ctx, cv.width / 2, cv.height * 0.56, s, { color, facing: 1, t, moving: false, ghost: opts.ghost });
}

/** Walk cycle frames kept per sprite (idle is frame 0). */
export const WALK_FRAMES = 6;
const WALK_PERIOD = (Math.PI * 2) / 11;

/**
 * Pre-rendered divers and bodies at the current zoom. Each pose is drawn with
 * paths once and then only blitted, which is far cheaper per frame than
 * re-tracing ~40 paths per diver (15 divers at 60 fps on a phone).
 */
export class SpriteCache {
  private size = 0;
  private readonly divers = new Map<string, HTMLCanvasElement>();
  private readonly bodies = new Map<number, HTMLCanvasElement>();
  private readonly labels = new Map<string, HTMLCanvasElement>();

  /** Sprite box relative to the diver size `s`; the anchor is the body center. */
  static readonly W = 1.3;
  static readonly H = 1.45;
  static readonly AX = 0.65;
  static readonly AY = 0.85;

  setSize(s: number): void {
    const next = Math.max(8, Math.round(s));
    if (next === this.size) return;
    this.size = next;
    this.divers.clear();
    this.bodies.clear();
    this.labels.clear();
  }

  get s(): number {
    return this.size;
  }

  /** Walk frame for time `t` (0 = standing). */
  static frameAt(t: number, moving: boolean): number {
    if (!moving) return 0;
    return 1 + (Math.floor((t / WALK_PERIOD) * WALK_FRAMES) % WALK_FRAMES);
  }

  diver(color: number, ghost: boolean, frame: number): HTMLCanvasElement {
    const key = `${color}:${ghost ? 1 : 0}:${frame}`;
    let cv = this.divers.get(key);
    if (cv) return cv;
    const s = this.size;
    cv = document.createElement('canvas');
    cv.width = Math.ceil(s * SpriteCache.W);
    cv.height = Math.ceil(s * SpriteCache.H);
    const ctx = cv.getContext('2d')!;
    const moving = frame > 0;
    // Frame k samples the walk cycle at k/WALK_FRAMES of a period; idle uses a fixed pose.
    const t = moving ? ((frame - 1) / WALK_FRAMES) * WALK_PERIOD + 0.0001 : 0.6;
    drawDiver(ctx, s * SpriteCache.AX, s * SpriteCache.AY, s, { color, facing: 1, t, moving, ghost });
    this.divers.set(key, cv);
    return cv;
  }

  body(color: number): HTMLCanvasElement {
    let cv = this.bodies.get(color);
    if (cv) return cv;
    const s = this.size;
    cv = document.createElement('canvas');
    cv.width = Math.ceil(s * SpriteCache.W);
    cv.height = Math.ceil(s * SpriteCache.H);
    const ctx = cv.getContext('2d')!;
    // t chosen so no bubble is drawn: bubbles are animated live by the renderer.
    drawBody(ctx, s * SpriteCache.AX, s * SpriteCache.AY, s, color, 0, false);
    this.bodies.set(color, cv);
    return cv;
  }

  /** A name tag rendered once (outlined text is expensive to redraw every frame). */
  label(text: string, color: string, px: number, outline: number): HTMLCanvasElement {
    const key = `${text}|${color}|${px}|${outline}`;
    const font = `700 ${px}px system-ui, sans-serif`;
    let cv = this.labels.get(key);
    if (cv) return cv;
    cv = document.createElement('canvas');
    const ctx = cv.getContext('2d')!;
    ctx.font = font;
    const w = Math.ceil(ctx.measureText(text).width + outline * 2 + 2);
    const h = Math.ceil(px * 1.4 + outline * 2);
    cv.width = Math.max(1, w);
    cv.height = Math.max(1, h);
    ctx.font = font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = outline;
    ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    ctx.strokeText(text, w / 2, h / 2);
    ctx.fillStyle = color;
    ctx.fillText(text, w / 2, h / 2);
    this.labels.set(key, cv);
    return cv;
  }
}

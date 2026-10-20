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
  const glow = 0.75 + Math.sin(look.t * 3) * 0.25;
  ctx.fillStyle = `rgba(253,230,138,${glow})`;
  ctx.shadowColor = '#fde68a';
  ctx.shadowBlur = s * 0.25;
  ctx.beginPath();
  ctx.arc(hx + f * s * 0.04, hy - hr - s * 0.12, s * 0.05, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** A fallen diver: lying on its side, cracked dome, bubbles rising. */
export function drawBody(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number, color: number, t: number): void {
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

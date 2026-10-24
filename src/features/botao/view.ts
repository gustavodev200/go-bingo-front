import { botaoTeamOf, type BotaoFrame, type BotaoMatchPhase } from '@/contracts';

export interface RenderDisc {
  seat: number;
  team: number;
  x: number;
  y: number;
  /** Chute armado (contorno branco). */
  kick: boolean;
  label: string;
  name: string;
  me: boolean;
}

export interface FieldView {
  players: RenderDisc[];
  ball: { x: number; y: number };
  phase: BotaoMatchPhase;
  kickTeam: number;
}

export interface TimedFrame {
  /** performance.now() da chegada. */
  at: number;
  frame: BotaoFrame;
}

/** Os outros são desenhados um pouco no passado para haver dois quadros para misturar. */
export const INTERP_MS = 60;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Os dois quadros em volta de `renderAt` e o quanto misturar entre eles. */
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

/** Saltos maiores que isto (bola de volta ao meio depois do gol) não são interpolados. */
const TELEPORT = 80;

/**
 * Cena de `now`: bola e outros botões interpolados, o meu da previsão.
 */
export function buildView(frames: TimedFrame[], now: number, opts: { mySeat: number; me: { x: number; y: number } | null; meKick: boolean; nameOf(seat: number): string }): FieldView | null {
  if (!frames.length) return null;
  const latest = frames[frames.length - 1].frame;
  const { a, b, t } = bracket(frames, now - INTERP_MS);
  const f0 = a.frame;
  const f1 = b.frame;
  const mix = (x0: number, x1: number, y0: number, y1: number): [number, number] => (Math.hypot(x1 - x0, y1 - y0) > TELEPORT ? [x1, y1] : [lerp(x0, x1, t), lerp(y0, y1, t)]);

  const players = f1.players.map((p1): RenderDisc => {
    const p0 = f0.players.find((q) => q[0] === p1[0]) ?? p1;
    const [x, y] = mix(p0[1], p1[1], p0[2], p1[2]);
    const name = opts.nameOf(p1[0]);
    const disc: RenderDisc = { seat: p1[0], team: botaoTeamOf(p1[0]), x, y, kick: p1[5] === 1, label: (name.trim()[0] ?? '?').toUpperCase(), name, me: p1[0] === opts.mySeat };
    if (disc.me && opts.me) {
      disc.x = opts.me.x;
      disc.y = opts.me.y;
      disc.kick = opts.meKick;
    }
    return disc;
  });
  const [bx, by] = mix(f0.ball[0], f1.ball[0], f0.ball[1], f1.ball[1]);
  return { players, ball: { x: bx, y: by }, phase: latest.phase, kickTeam: latest.kickTeam };
}

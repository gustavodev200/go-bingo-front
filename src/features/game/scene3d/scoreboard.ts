import { letterFor } from '@/contracts';
import type { Vec3 } from './slots';

export const SCOREBOARD_W = 1024;
export const SCOREBOARD_H = 512;
/** Centro e tamanho (mundo) da tela do telão — usados pelo componente e pela câmera. */
export const SCOREBOARD_CENTER: Vec3 = [0, 3.3, -5.09];
export const SCOREBOARD_SIZE: [number, number] = [6.8, 3.4];
export const LIT = '#fde047';
const BG = '#111827';
const DIM = '#374151';

export type ScoreboardView =
  | { kind: 'lobby'; name: string; code: string }
  | { kind: 'game'; drawn: readonly number[] }
  | { kind: 'won'; nickname: string; isMe: boolean }
  | { kind: 'ended' };

export type ScoreboardCtx = Pick<CanvasRenderingContext2D, 'fillStyle' | 'font' | 'textAlign' | 'textBaseline' | 'fillRect' | 'fillText' | 'beginPath' | 'arc' | 'fill'>;

export function scoreboardView(i: {
  phase: 'lobby' | 'game';
  name: string;
  code: string;
  drawn: readonly number[];
  winner: { userId: string; nickname: string } | null;
  ended: boolean;
  myUserId: string | null;
}): ScoreboardView {
  if (i.winner) return { kind: 'won', nickname: i.winner.nickname, isMe: i.winner.userId === i.myUserId };
  if (i.ended) return { kind: 'ended' };
  if (i.phase === 'game') return { kind: 'game', drawn: i.drawn };
  return { kind: 'lobby', name: i.name, code: i.code };
}

function text(ctx: ScoreboardCtx, value: string, x: number, y: number, font: string, color: string) {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.fillText(value, x, y);
}

function ball(ctx: ScoreboardCtx, x: number, y: number, r: number) {
  ctx.fillStyle = LIT;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function drawGame(ctx: ScoreboardCtx, drawn: readonly number[]) {
  const current = drawn.at(-1);
  if (current === undefined) {
    text(ctx, 'Aguardando', 200, 230, 'bold 44px sans-serif', '#c4b5fd');
  } else {
    ball(ctx, 200, 220, 150);
    text(ctx, letterFor(current), 200, 140, 'bold 64px sans-serif', BG);
    text(ctx, String(current), 200, 245, 'bold 150px sans-serif', BG);
  }
  drawn
    .slice(-5, -1)
    .reverse()
    .forEach((n, i) => {
      ball(ctx, 65 + i * 90, 445, 38);
      text(ctx, `${letterFor(n)}${n}`, 65 + i * 90, 447, 'bold 26px sans-serif', BG);
    });
  const lit = new Set(drawn);
  ['B', 'I', 'N', 'G', 'O'].forEach((letter, row) => text(ctx, letter, 440, 75 + row * 92, 'bold 40px sans-serif', LIT));
  for (let n = 1; n <= 75; n++) {
    const row = Math.floor((n - 1) / 15);
    const col = (n - 1) % 15;
    const x = 470 + col * 36;
    const y = 40 + row * 92;
    ctx.fillStyle = lit.has(n) ? LIT : DIM;
    ctx.fillRect(x, y, 30, 70);
    text(ctx, String(n), x + 15, y + 35, 'bold 18px sans-serif', lit.has(n) ? BG : '#9ca3af');
  }
}

/** Desenha o telão numa canvas 2D (vira CanvasTexture). Testável com um ctx falso. */
export function drawScoreboard(ctx: ScoreboardCtx, view: ScoreboardView): void {
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, SCOREBOARD_W, SCOREBOARD_H);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  switch (view.kind) {
    case 'lobby':
      text(ctx, view.name, SCOREBOARD_W / 2, 130, 'bold 56px sans-serif', '#fef3c7');
      text(ctx, view.code, SCOREBOARD_W / 2, 300, 'bold 170px sans-serif', LIT);
      text(ctx, 'Código da sala', SCOREBOARD_W / 2, 440, '36px sans-serif', '#c4b5fd');
      return;
    case 'won':
      text(ctx, 'BINGO!', SCOREBOARD_W / 2, 210, 'bold 190px sans-serif', LIT);
      text(ctx, view.isMe ? 'Você!' : view.nickname, SCOREBOARD_W / 2, 400, 'bold 72px sans-serif', '#ffffff');
      return;
    case 'ended':
      text(ctx, 'Fim de jogo', SCOREBOARD_W / 2, 220, 'bold 110px sans-serif', '#fef3c7');
      text(ctx, 'Ninguém completou a cartela', SCOREBOARD_W / 2, 360, '44px sans-serif', '#c4b5fd');
      return;
    case 'game':
      drawGame(ctx, view.drawn);
  }
}

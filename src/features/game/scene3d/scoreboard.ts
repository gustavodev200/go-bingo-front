import { LETTER_COLORS } from './ambience';
import type { Vec3 } from './slots';

export const SCOREBOARD_W = 1024;
export const SCOREBOARD_H = 512;
/** Centro e tamanho (mundo) da tela do telão — usados pelo componente e pela câmera. */
export const SCOREBOARD_CENTER: Vec3 = [0, 3.3, -5.09];
export const SCOREBOARD_SIZE: [number, number] = [6.8, 3.4];
export const LIT = '#fde047';
const BG = '#111827';

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

function disc(ctx: ScoreboardCtx, x: number, y: number, r: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Partida: a bola da vez e as anteriores ficam na HUD em DOM (nítidas no celular); o telão vira cenário legível
 * de longe — letreiro BINGO nas cores das colunas e quantas bolas já saíram.
 */
function drawGame(ctx: ScoreboardCtx, drawn: readonly number[]) {
  (['B', 'I', 'N', 'G', 'O'] as const).forEach((letter, i) => {
    const x = SCOREBOARD_W / 2 + (i - 2) * 150;
    disc(ctx, x, 150, 62, LETTER_COLORS[letter]);
    disc(ctx, x, 150, 38, '#ffffff');
    text(ctx, letter, x, 152, 'bold 46px sans-serif', '#0f0f14');
  });
  if (drawn.length === 0) {
    text(ctx, 'Aguardando', SCOREBOARD_W / 2, 360, 'bold 96px sans-serif', '#c4b5fd');
    return;
  }
  text(ctx, `${drawn.length}/75`, SCOREBOARD_W / 2, 340, 'bold 150px sans-serif', LIT);
  text(ctx, 'bolas sorteadas', SCOREBOARD_W / 2, 455, '44px sans-serif', '#c4b5fd');
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

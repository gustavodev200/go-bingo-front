import { BOTAO_BALL_R, BOTAO_CENTER_R, BOTAO_FIELD_H, BOTAO_FIELD_W, BOTAO_GOAL_DEPTH, BOTAO_GOAL_H, BOTAO_MARGIN, BOTAO_PLAYER_R, BOTAO_POST_R, BOTAO_POSTS, BOTAO_TEAMS } from '@/contracts';
import { toScreen, type Orient } from '../input';
import type { FieldView } from '../view';

/** Tamanho do mundo desenhado (campo + margem) com o campo deitado. */
export const WORLD_W = (BOTAO_FIELD_W + BOTAO_MARGIN) * 2;
export const WORLD_H = (BOTAO_FIELD_H + BOTAO_MARGIN) * 2;

const GRASS_OUT = '#4a7a36';
const GRASS_A = '#5d9a43';
const GRASS_B = '#56903d';
const LINE = 'rgba(240, 255, 232, 0.9)';

/**
 * Desenha o campo num canvas 2D. O gramado e as linhas ficam num canvas fora da tela, refeito só
 * quando o tamanho ou a orientação mudam; a cada quadro só vão bola, botões e nomes.
 */
export class FieldRenderer {
  private readonly ctx: CanvasRenderingContext2D;
  private bg: HTMLCanvasElement | null = null;
  private scale = 1;
  private dpr = 1;
  orient: Orient = 0;
  cssW = 0;
  cssH = 0;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
  }

  /** Cabe o campo em `maxW` x `maxH` (px CSS). Em pé (orient 1/2) o campo gira 90°. */
  resize(maxW: number, maxH: number, orient: Orient): void {
    this.orient = orient;
    const ww = orient ? WORLD_H : WORLD_W;
    const wh = orient ? WORLD_W : WORLD_H;
    this.scale = Math.max(0.1, Math.min(maxW / ww, maxH / wh));
    this.cssW = Math.floor(ww * this.scale);
    this.cssH = Math.floor(wh * this.scale);
    this.dpr = Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);
    this.canvas.width = Math.floor(this.cssW * this.dpr);
    this.canvas.height = Math.floor(this.cssH * this.dpr);
    this.canvas.style.width = `${this.cssW}px`;
    this.canvas.style.height = `${this.cssH}px`;
    this.bg = this.drawBackground();
  }

  /** Ponto do campo → pixel do canvas (já com DPR). */
  project(x: number, y: number): [number, number] {
    const [sx, sy] = toScreen(x, y, this.orient);
    const k = this.scale * this.dpr;
    return [this.canvas.width / 2 + sx * k, this.canvas.height / 2 + sy * k];
  }

  /** Transformação do mundo para desenhar formas (linhas, redes) com a rotação certa. */
  private worldTransform(ctx: CanvasRenderingContext2D): void {
    const k = this.scale * this.dpr;
    const cx = this.canvas.width / 2;
    const cy = this.canvas.height / 2;
    if (this.orient === 1) ctx.setTransform(0, -k, k, 0, cx, cy);
    else if (this.orient === 2) ctx.setTransform(0, k, -k, 0, cx, cy);
    else ctx.setTransform(k, 0, 0, k, cx, cy);
  }

  private drawBackground(): HTMLCanvasElement | null {
    if (typeof document === 'undefined') return null;
    const off = document.createElement('canvas');
    off.width = this.canvas.width;
    off.height = this.canvas.height;
    const g = off.getContext('2d');
    if (!g) return null;
    const W = BOTAO_FIELD_W;
    const H = BOTAO_FIELD_H;
    const G = BOTAO_GOAL_H;
    const D = BOTAO_GOAL_DEPTH;
    this.worldTransform(g);
    g.fillStyle = GRASS_OUT;
    g.fillRect(-WORLD_W / 2, -WORLD_H / 2, WORLD_W, WORLD_H);
    const stripes = 10;
    const sw = (W * 2) / stripes;
    for (let i = 0; i < stripes; i++) {
      g.fillStyle = i % 2 ? GRASS_A : GRASS_B;
      g.fillRect(-W + i * sw, -H, sw + 0.5, H * 2);
    }

    g.strokeStyle = LINE;
    g.lineWidth = 3;
    g.lineJoin = 'round';
    g.strokeRect(-W, -H, W * 2, H * 2);
    g.beginPath();
    g.moveTo(0, -H);
    g.lineTo(0, H);
    g.stroke();
    g.beginPath();
    g.arc(0, 0, BOTAO_CENTER_R, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = LINE;
    g.beginPath();
    g.arc(0, 0, 4, 0, Math.PI * 2);
    g.fill();
    // Grandes áreas em arco, só de enfeite.
    for (const side of [-1, 1]) {
      g.beginPath();
      g.arc(side * W, 0, 110, side < 0 ? -Math.PI / 2 : Math.PI / 2, side < 0 ? Math.PI / 2 : (3 * Math.PI) / 2);
      g.stroke();
      for (const sy of [-1, 1]) {
        g.beginPath();
        g.arc(side * W, sy * H, 14, 0, Math.PI * 2);
        g.save();
        g.clip(new Path2D(`M ${-W} ${-H} h ${W * 2} v ${H * 2} h ${-W * 2} Z`));
        g.stroke();
        g.restore();
      }
    }

    // Redes: fundo escuro, trama e a moldura.
    for (const side of [-1, 1]) {
      const x0 = side < 0 ? -W - D : W;
      g.fillStyle = 'rgba(15, 30, 15, 0.35)';
      g.fillRect(x0, -G, D, G * 2);
      g.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      g.lineWidth = 1;
      g.beginPath();
      for (let y = -G; y <= G; y += 8) {
        g.moveTo(x0, y);
        g.lineTo(x0 + D, y);
      }
      for (let x = 0; x <= D; x += 8) {
        g.moveTo(x0 + x, -G);
        g.lineTo(x0 + x, G);
      }
      g.stroke();
      g.strokeStyle = '#1b1b1b';
      g.lineWidth = 2.5;
      g.beginPath();
      g.moveTo(side * W, -G);
      g.lineTo(side * (W + D), -G);
      g.lineTo(side * (W + D), G);
      g.lineTo(side * W, G);
      g.stroke();
    }
    for (const [x, y] of BOTAO_POSTS) {
      g.fillStyle = '#ffffff';
      g.strokeStyle = '#1b1b1b';
      g.lineWidth = 2;
      g.beginPath();
      g.arc(x, y, BOTAO_POST_R, 0, Math.PI * 2);
      g.fill();
      g.stroke();
    }
    return off;
  }

  draw(view: FieldView, now: number): void {
    const ctx = this.ctx;
    const k = this.scale * this.dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (this.bg) ctx.drawImage(this.bg, 0, 0);
    else {
      ctx.fillStyle = GRASS_A;
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    // Saída de bola: o meio-campo de quem sai fica destacado.
    if (view.phase === 'kickoff' || view.phase === 'countdown') {
      const [cx, cy] = this.project(0, 0);
      ctx.strokeStyle = BOTAO_TEAMS[view.kickTeam].color;
      ctx.globalAlpha = 0.55 + 0.25 * Math.sin(now / 180);
      ctx.lineWidth = 4 * this.dpr;
      ctx.beginPath();
      ctx.arc(cx, cy, BOTAO_CENTER_R * k, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    const pr = BOTAO_PLAYER_R * k;
    const br = BOTAO_BALL_R * k;
    // Sombras primeiro, todas de uma vez.
    ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
    ctx.beginPath();
    for (const p of view.players) {
      const [x, y] = this.project(p.x, p.y);
      ctx.moveTo(x + pr + 2 * k, y + 3 * k);
      ctx.arc(x + 2 * k, y + 3 * k, pr, 0, Math.PI * 2);
    }
    const [bx, by] = this.project(view.ball.x, view.ball.y);
    ctx.moveTo(bx + br + 2 * k, by + 3 * k);
    ctx.arc(bx + 2 * k, by + 3 * k, br, 0, Math.PI * 2);
    ctx.fill();

    const font = Math.max(10, Math.round(13 * k));
    const nameFont = Math.max(9, Math.round(10 * k));
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const p of view.players) {
      const [x, y] = this.project(p.x, p.y);
      if (p.me) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
        ctx.lineWidth = 3 * this.dpr;
        ctx.beginPath();
        ctx.arc(x, y, pr + (6 + Math.sin(now / 160) * 1.5) * k, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.fillStyle = BOTAO_TEAMS[p.team].color;
      ctx.beginPath();
      ctx.arc(x, y, pr, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = (p.kick ? 3.5 : 2) * k;
      ctx.strokeStyle = p.kick ? '#ffffff' : '#111111';
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.font = `800 ${font}px system-ui, sans-serif`;
      ctx.fillText(p.label, x, y + 0.5 * k);
      ctx.font = `600 ${nameFont}px system-ui, sans-serif`;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      const label = p.me ? 'Você' : p.name;
      ctx.fillText(label, x + 1, y - pr - 7 * k + 1);
      ctx.fillStyle = p.me ? '#fff7c2' : 'rgba(255, 255, 255, 0.85)';
      ctx.fillText(label, x, y - pr - 7 * k);
    }

    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#111111';
    ctx.lineWidth = 2 * k;
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
}

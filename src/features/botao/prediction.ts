import { BOTAO_SUBSTEPS, botaoConfinePlayer, botaoMovePlayer, botaoNewPlayer, botaoTeamOf, type BotaoDisc, type BotaoFrame, type BotaoKickoff } from '@/contracts';

const MAX_PENDING = 90;
const SNAP_DISTANCE = 40;
const ERROR_DECAY = 0.85;

const kickoffOf = (frame: BotaoFrame): BotaoKickoff | null => (frame.phase === 'kickoff' || frame.phase === 'countdown' ? { kickTeam: frame.kickTeam } : null);

/** Um tick do meu botão com o mesmo código do servidor (sem encostar em ninguém). */
export function simulate(p: BotaoDisc, d: number, k: boolean, team: number, kickoff: BotaoKickoff | null): void {
  for (let i = 0; i < BOTAO_SUBSTEPS; i++) {
    botaoMovePlayer(p, d, k);
    botaoConfinePlayer(p, team, kickoff);
  }
}

/**
 * Previsão do meu botão: o comando move na hora, com a mesma física do servidor; cada quadro
 * volta à posição oficial e repete os comandos que o servidor ainda não processou. A diferença
 * que sobra some aos poucos em vez de dar tranco.
 */
export class Predictor {
  disc: BotaoDisc | null = null;
  kicking = false;
  private team = 0;
  private pending: { s: number; d: number; k: boolean }[] = [];
  private seq = 0;
  private errX = 0;
  private errY = 0;

  reset(): void {
    this.disc = null;
    this.pending = [];
    this.errX = this.errY = 0;
  }

  get pendingCount(): number {
    return this.pending.length;
  }

  /** Aplica um quadro oficial. */
  reconcile(frame: BotaoFrame, mySeat: number): void {
    const me = frame.players.find((p) => p[0] === mySeat);
    if (!me) {
      this.reset();
      return;
    }
    this.team = botaoTeamOf(mySeat);
    const [, x, y, vx, vy, , lastSeq] = me;
    const base = botaoNewPlayer(x, y);
    base.vx = vx;
    base.vy = vy;
    if (!this.disc || frame.phase === 'countdown') {
      this.disc = base;
      this.pending = [];
      this.errX = this.errY = 0;
      return;
    }
    this.pending = this.pending.filter((i) => i.s > lastSeq);
    const kickoff = kickoffOf(frame);
    for (const i of this.pending) simulate(base, i.d, i.k, this.team, kickoff);
    this.errX += this.disc.x - base.x;
    this.errY += this.disc.y - base.y;
    if (Math.hypot(this.errX, this.errY) > SNAP_DISTANCE) this.errX = this.errY = 0;
    this.disc = base;
  }

  /** Um tick do cliente: devolve a sequência a mandar, ou null quando não dá para jogar. */
  step(frame: BotaoFrame | null, d: number, k: boolean): number | null {
    if (!frame || !this.disc) return null;
    if (frame.phase === 'countdown' || frame.phase === 'over') return null;
    const s = ++this.seq;
    this.pending.push({ s, d, k });
    if (this.pending.length > MAX_PENDING) this.pending.shift();
    simulate(this.disc, d, k, this.team, kickoffOf(frame));
    this.kicking = k;
    return s;
  }

  /** Onde desenhar o meu botão agora (previsão + correção que vai sumindo). */
  render(): { x: number; y: number } | null {
    if (!this.disc) return null;
    this.errX *= ERROR_DECAY;
    this.errY *= ERROR_DECAY;
    return { x: this.disc.x + this.errX, y: this.disc.y + this.errY };
  }
}

import { BJ_BET_STEP, BJ_MAX_BET, BJ_MIN_BET, type BjAction, type BjEndReason, type BjHandView, type BjOutcome, type BjPlayerView, type BjRules } from '@/contracts';

export const ACTION_LABEL: Record<BjAction, string> = { hit: 'Pedir', stand: 'Parar', double: 'Dobrar', split: 'Dividir', surrender: 'Render' };
export const ACTION_HINT: Record<BjAction, string> = {
  hit: 'mais uma carta',
  stand: 'fico com esta',
  double: 'aposta x2, 1 carta',
  split: 'duas mãos',
  surrender: 'metade de volta',
};

export const OUTCOME_LABEL: Record<BjOutcome, string> = { win: 'Ganhou', blackjack: 'Blackjack!', push: 'Empate', lose: 'Perdeu', surrender: 'Rendeu' };

export function rulesSummary(rules: BjRules): string {
  return `${rules.rounds} rodadas · paga ${rules.payout} · ${rules.decks} baralhos`;
}

/** "17", "soft 17" as A/7, or "21" — the way players say it at the table. */
export function totalLabel(hand: Pick<BjHandView, 'cards' | 'total' | 'soft' | 'status' | 'split'>): string {
  if (hand.status === 'blackjack') return 'BJ';
  if (hand.soft && hand.total < 21 && hand.status === 'playing') return `${hand.total - 10}/${hand.total}`;
  return String(hand.total);
}

/** Bet the player is allowed to pick right now: step-aligned, inside the table limits and the stack. */
export function clampBet(amount: number, chips: number): number {
  const max = Math.min(BJ_MAX_BET, Math.floor(chips / BJ_BET_STEP) * BJ_BET_STEP);
  const stepped = Math.round(amount / BJ_BET_STEP) * BJ_BET_STEP;
  return Math.max(Math.min(BJ_MIN_BET, max), Math.min(stepped, max));
}

/** Chips on the table plus in the stack: what the player is "worth" mid-round. */
export function stackOf(p: BjPlayerView): number {
  const onTable = p.hands.length > 0 ? p.hands.reduce((sum, h) => sum + h.bet, 0) : (p.bet ?? 0);
  return p.chips + onTable + (p.insurance ?? 0);
}

export function endReasonText(reason: BjEndReason): string {
  switch (reason) {
    case 'rounds':
      return 'Todas as rodadas foram jogadas. Vence quem terminou com mais fichas.';
    case 'broke':
      return 'Todo mundo ficou sem fichas para a aposta mínima.';
    case 'abandoned':
      return 'Só sobrou um jogador na mesa.';
  }
}

export const placementLabel = (placement: number) => `${placement}º`;

export const fmtChips = (n: number) => n.toLocaleString('pt-BR');

'use client';

import { BONUS_LABELS, TIERS, type MatchResultDto } from '@/contracts';
import { Coins } from '@/components/stage/coin';
import { cn } from '@/lib/utils';
import { tierIcon } from './tier-badge';
import { useMatchReward } from './use-match-reward';

function Line({ label, children, tone }: { label: string; children: React.ReactNode; tone?: 'plus' | 'minus' }) {
  return (
    <li className="flex items-center justify-between gap-3 text-sm">
      <span className={cn('text-left', tone === 'minus' ? 'text-rose-200' : 'text-violet-100')}>{label}</span>
      <span className={cn('font-semibold tabular-nums', tone === 'plus' && 'text-emerald-300', tone === 'minus' && 'text-rose-300')}>{children}</span>
    </li>
  );
}

function ratingNote(r: MatchResultDto): string | null {
  if (r.rated) return null;
  if (r.abandoned) return 'Quem sai no meio perde pontos e paga multa.';
  return 'Sem pontos: precisa de uma partida completa contra outro jogador logado.';
}

/** O extrato da partida: entrada, prêmio, bônus, pontos, sequência e liga. */
export function MatchRewardPanel() {
  const { reward, status } = useMatchReward();
  if (status === 'missing') return null;
  if (!reward) {
    return (
      <p aria-busy="true" className="rounded-2xl bg-white/5 py-3 text-center text-sm text-violet-200/80">
        Calculando suas recompensas…
      </p>
    );
  }
  const note = ratingNote(reward);
  const streakLabel = reward.streak >= 2 ? `🔥 ${reward.streak} vitórias seguidas` : reward.streak <= -3 ? `${-reward.streak} derrotas seguidas — a próxima vitória rende bônus de virada` : null;
  return (
    <section aria-label="Recompensas da partida" className="flex w-full flex-col gap-3 rounded-2xl bg-white/5 p-4 text-left ring-1 ring-white/10">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs font-semibold tracking-widest text-violet-200/70 uppercase">Moedas</p>
          <Coins amount={reward.coinsDelta} signed className={cn('text-2xl', reward.coinsDelta >= 0 ? 'text-amber-300' : 'text-rose-300')} />
        </div>
        <div className="text-right">
          <p className="text-xs font-semibold tracking-widest text-violet-200/70 uppercase">Ranking</p>
          <p className={cn('font-display text-2xl font-bold tabular-nums', reward.pointsDelta > 0 ? 'text-emerald-300' : reward.pointsDelta < 0 ? 'text-rose-300' : 'text-white/70')}>
            {reward.pointsDelta > 0 ? '+' : reward.pointsDelta < 0 ? '−' : ''}
            {Math.abs(reward.pointsDelta)} pts
          </p>
        </div>
      </div>

      <ul className="flex flex-col gap-1 border-t border-white/10 pt-2">
        {reward.staked > 0 && (
          <Line label="Entrada" tone="minus">
            <Coins amount={-reward.staked} signed />
          </Line>
        )}
        {reward.prize > 0 && (
          <Line label={reward.players > 2 ? 'Sua parte do pote' : 'Pote da mesa'} tone="plus">
            <Coins amount={reward.prize} signed />
          </Line>
        )}
        {reward.bonuses.map((b) => (
          <Line key={b.code} label={BONUS_LABELS[b.code]} tone="plus">
            <Coins amount={b.amount} signed />
          </Line>
        ))}
        {reward.tierUp && (
          <Line label={`${tierIcon(reward.tierUp.tier)} Subiu para ${TIERS.find((t) => t.id === reward.tierUp!.tier)?.label}`} tone="plus">
            <Coins amount={reward.tierUp.coins} signed />
          </Line>
        )}
      </ul>

      {reward.tierUp && (
        <p role="status" className="rounded-xl bg-amber-300/15 px-3 py-2 text-center text-sm font-bold text-amber-200 ring-1 ring-amber-300/40">
          {tierIcon(reward.tierUp.tier)} Nova liga: {TIERS.find((t) => t.id === reward.tierUp!.tier)?.label}!
        </p>
      )}
      {streakLabel && <p className="text-center text-sm font-semibold text-orange-200">{streakLabel}</p>}
      {note && <p className="text-center text-xs text-violet-200/70">{note}</p>}
    </section>
  );
}

'use client';

import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import type { TrucoBetResponse, TrucoBetVotes, TrucoCard, TrucoRules } from '@/contracts';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { PlayingCard } from './playing-card';
import { BET_LABEL, type AvailableActions } from './rules-view';

/** Wraps an async action so a second tap while it runs is ignored. */
export function useBusy() {
  const [busy, setBusy] = useState(false);
  const run = (fn: () => Promise<unknown>) => async () => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };
  return { busy, run };
}

const shoutButton = 'h-12 rounded-2xl px-5 font-display text-lg font-black tracking-wide uppercase shadow-[0_4px_0_rgb(0_0_0/0.35)] active:translate-y-0.5 active:shadow-none';

export function ActionBar({
  actions,
  partnerCards,
  onRequestBet,
  onRespond,
  onDecideTen,
  turnName,
  rules,
  betVotes = null,
  partnerName = null,
}: {
  actions: AvailableActions;
  rules: TrucoRules;
  partnerCards: TrucoCard[] | null;
  onRequestBet(): Promise<unknown>;
  onRespond(response: TrucoBetResponse): Promise<unknown>;
  onDecideTen(play: boolean): Promise<unknown>;
  turnName: string | null;
  /** My vote and my partner's while our team answers a bet. */
  betVotes?: TrucoBetVotes | null;
  partnerName?: string | null;
}) {
  const { busy, run } = useBusy();

  if (actions.tenDecision === 'mine') {
    return (
      <div className="flex flex-col items-center gap-2" role="group" aria-label={rules.tenHandName}>
        <p className="text-center text-sm font-bold text-amber-200">
          {rules.tenHandName}! Vale {rules.tenHandValue} se jogarem; correndo, eles ganham {rules.tenRunPoints}.
        </p>
        {partnerCards && (
          <div className="flex items-center gap-2 rounded-2xl bg-black/30 px-3 py-2">
            <span className="text-xs font-semibold text-emerald-200">Cartas do parceiro:</span>
            {partnerCards.map((c) => (
              <PlayingCard key={`${c.rank}${c.suit}`} card={c} size="sm" />
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <Button disabled={busy} onClick={run(() => onDecideTen(true))} className={cn(shoutButton, 'from-emerald-300 to-emerald-600 text-white [--primary-shadow:var(--color-emerald-800)]')}>
            Jogar
          </Button>
          <Button disabled={busy} variant="secondary" onClick={run(() => onDecideTen(false))} className={shoutButton}>
            Correr
          </Button>
        </div>
      </div>
    );
  }
  if (actions.tenDecision === 'theirs') return <Status>Adversários decidindo a {rules.tenHandName.toLowerCase()}…</Status>;

  if (actions.mustRespond) {
    const mine = betVotes?.mine ?? null;
    const partner = betVotes?.partner ?? null;
    const label: Record<TrucoBetResponse, string> = { accept: 'Aceitar', run: 'Correr', raise: actions.raiseValue !== null ? `${BET_LABEL[actions.raiseValue]}!` : 'Aumentar' };
    const vote = (response: TrucoBetResponse, className: string, variant?: 'secondary') => (
      <Button
        disabled={busy}
        variant={variant}
        aria-pressed={mine === response}
        onClick={run(() => onRespond(response))}
        className={cn(shoutButton, className, mine === response && 'ring-4 ring-amber-300 ring-offset-2 ring-offset-black/40', mine !== null && mine !== response && 'opacity-60')}
      >
        {label[response]}
      </Button>
    );
    return (
      <div className="flex flex-col items-center gap-1.5" role="group" aria-label="Responder aposta">
        <p className="text-center text-xs font-semibold text-violet-100">Votação da dupla · se discordarem, vale o voto mais ousado</p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          {vote('accept', 'from-emerald-300 to-emerald-600 text-white [--primary-shadow:var(--color-emerald-800)]')}
          {vote('run', '', 'secondary')}
          {actions.raiseValue !== null && vote('raise', 'from-rose-400 to-red-700 text-white [--primary-shadow:var(--color-red-900)]')}
        </div>
        <p role="status" className={cn('rounded-full px-3 py-0.5 text-sm font-bold', partner ? 'bg-emerald-400 text-emerald-950' : 'bg-white/10 text-violet-100')}>
          {partner ? `${partnerName ?? 'Seu parceiro'} votou: ${label[partner]}` : 'Seu parceiro ainda não votou'}
        </p>
      </div>
    );
  }
  if (actions.waitingResponse) return <Status>Adversários votando… ({actions.votesCast}/2)</Status>;

  return (
    <div className="flex min-h-12 items-center justify-center gap-3">
      {actions.canPlay ? (
        <span className="rounded-full bg-amber-300 px-3 py-1 text-sm font-black text-amber-950 shadow" role="status">
          Sua vez!
        </span>
      ) : (
        turnName && <Status>Vez de {turnName}</Status>
      )}
      {actions.requestValue !== null && (
        <Button disabled={busy} onClick={run(onRequestBet)} className={cn(shoutButton, 'from-rose-400 to-red-700 text-white [--primary-shadow:var(--color-red-900)]')}>
          {busy ? <Loader2 aria-hidden className="animate-spin" /> : null}
          {BET_LABEL[actions.requestValue]}!
        </Button>
      )}
    </div>
  );
}

function Status({ children }: { children: React.ReactNode }) {
  return (
    <p role="status" className="flex min-h-12 items-center justify-center text-center text-sm font-semibold text-violet-100">
      {children}
    </p>
  );
}

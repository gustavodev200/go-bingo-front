'use client';

import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import type { TrucoBetResponse, TrucoCard, TrucoRules } from '@/contracts';
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
}: {
  actions: AvailableActions;
  rules: TrucoRules;
  partnerCards: TrucoCard[] | null;
  onRequestBet(): Promise<unknown>;
  onRespond(response: TrucoBetResponse): Promise<unknown>;
  onDecideTen(play: boolean): Promise<unknown>;
  turnName: string | null;
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
    return (
      <div className="flex flex-wrap items-center justify-center gap-2" role="group" aria-label="Responder aposta">
        <Button disabled={busy} onClick={run(() => onRespond('accept'))} className={cn(shoutButton, 'from-emerald-300 to-emerald-600 text-white [--primary-shadow:var(--color-emerald-800)]')}>
          Aceitar
        </Button>
        <Button disabled={busy} variant="secondary" onClick={run(() => onRespond('run'))} className={shoutButton}>
          Correr
        </Button>
        {actions.raiseValue !== null && (
          <Button disabled={busy} onClick={run(() => onRespond('raise'))} className={cn(shoutButton, 'from-rose-400 to-red-700 text-white [--primary-shadow:var(--color-red-900)]')}>
            {BET_LABEL[actions.raiseValue]}!
          </Button>
        )}
      </div>
    );
  }
  if (actions.waitingResponse) return <Status>Aguardando os adversários responderem…</Status>;

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

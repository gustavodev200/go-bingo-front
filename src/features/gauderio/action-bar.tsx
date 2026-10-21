'use client';

import { GAUD_CALL_LABEL, gaudCallKind, type GaudCall, type GaudPending, type GaudPrivateHand, type GaudVote } from '@/contracts';
import { Button } from '@/components/ui/button';
import { useBusy } from '@/features/truco/action-bar';
import { cn } from '@/lib/utils';
import { callButtonLabel, voteLabel } from './view';

const shoutButton =
  'h-11 rounded-2xl px-4 font-display text-base font-black tracking-wide uppercase shadow-[0_4px_0_rgb(0_0_0/0.35)] active:translate-y-0.5 active:shadow-none sm:h-12 sm:px-5 sm:text-lg';

const CALL_TONE: Record<ReturnType<typeof gaudCallKind>, string> = {
  truco: 'from-rose-400 to-red-700 text-white [--primary-shadow:var(--color-red-900)]',
  envido: 'from-sky-300 to-blue-700 text-white [--primary-shadow:var(--color-blue-900)]',
  flor: 'from-fuchsia-300 to-pink-600 text-white [--primary-shadow:var(--color-pink-900)]',
};

function Status({ children }: { children: React.ReactNode }) {
  return (
    <p role="status" className="flex min-h-11 items-center justify-center text-center text-sm font-semibold text-violet-100">
      {children}
    </p>
  );
}

/**
 * Botões do jogador: os cantos e as respostas vêm prontos do servidor
 * (`hand.actions`), então só aparece o que vale agora. Em duplas, a resposta a
 * um canto é votada: cada um vê o próprio voto e o do parceiro.
 */
export function ActionBar({
  hand,
  pending,
  pendingIsOurs,
  turnName,
  partnerName = null,
  teamVote = false,
  onCall,
  onRespond,
  onFold,
}: {
  hand: GaudPrivateHand | null;
  pending: GaudPending | null;
  /** Nós cantamos e esperamos a resposta. */
  pendingIsOurs: boolean;
  turnName: string | null;
  partnerName?: string | null;
  /** A resposta é votada com o parceiro (duplas, parceiro humano conectado). */
  teamVote?: boolean;
  onCall(call: GaudCall): Promise<unknown>;
  onRespond(accept: boolean): Promise<unknown>;
  onFold(): Promise<unknown>;
}) {
  const { busy, run } = useBusy();
  const a = hand?.actions;
  const calls = a?.calls ?? [];
  const mine = hand?.votes?.mine ?? null;
  const partner = hand?.votes?.partner ?? null;
  const flor = hand?.flor && calls.includes('flor');

  const voteButton = (vote: GaudVote, onClick: () => Promise<unknown>, className: string, variant?: 'secondary') => (
    <Button
      key={vote}
      disabled={busy}
      variant={variant}
      aria-pressed={teamVote ? mine === vote : undefined}
      onClick={run(onClick)}
      className={cn(shoutButton, className, teamVote && mine === vote && 'ring-4 ring-amber-300 ring-offset-2 ring-offset-black/40', teamVote && mine !== null && mine !== vote && 'opacity-60')}
    >
      {voteLabel(vote)}
    </Button>
  );

  if (pending && a && (a.canAccept || a.canDecline || calls.length > 0) && !pendingIsOurs) {
    return (
      <div className="flex flex-col items-center gap-1.5" role="group" aria-label="Responder canto">
        <p className="text-center text-sm font-bold text-amber-200">Cantaram {GAUD_CALL_LABEL[pending.call]}! O que você responde?</p>
        {teamVote && <p className="text-center text-xs font-semibold text-violet-100">Votação da dupla · se discordarem, vale o voto mais ousado</p>}
        <div className="flex flex-wrap items-center justify-center gap-2">
          {a.canAccept && voteButton('accept', () => onRespond(true), 'from-emerald-300 to-emerald-600 text-white [--primary-shadow:var(--color-emerald-800)]')}
          {a.canDecline && voteButton('decline', () => onRespond(false), '', 'secondary')}
          {calls.map((call) => voteButton(call, () => onCall(call), CALL_TONE[gaudCallKind(call)]))}
        </div>
        {teamVote && (
          <p role="status" className={cn('rounded-full px-3 py-0.5 text-sm font-bold', partner ? 'bg-emerald-400 text-emerald-950' : 'bg-white/10 text-violet-100')}>
            {partner ? `${partnerName ?? 'Seu parceiro'} votou: ${voteLabel(partner)}` : `${partnerName ?? 'Seu parceiro'} ainda não votou`}
          </p>
        )}
        {flor && <p className="text-xs font-semibold text-fuchsia-200">Você tem flor: pode cantar agora (é opcional).</p>}
      </div>
    );
  }
  if (pending) {
    const name = GAUD_CALL_LABEL[pending.call];
    const votes = pending.votes === 1 ? ' (1 voto)' : '';
    return <Status>{pendingIsOurs ? `Esperando a resposta ao ${name}…${votes}` : `${name}! Esperando a resposta…`}</Status>;
  }

  return (
    <div className="flex min-h-11 flex-wrap items-center justify-center gap-2">
      {a?.canFold || a?.canPlay ? (
        <span className="rounded-full bg-amber-300 px-3 py-1 text-sm font-black text-amber-950 shadow" role="status">
          Sua vez!
        </span>
      ) : (
        turnName && <Status>Vez de {turnName}</Status>
      )}
      {calls.map((call) => (
        <Button key={call} disabled={busy} onClick={run(() => onCall(call))} className={cn(shoutButton, CALL_TONE[gaudCallKind(call)])}>
          {callButtonLabel(call)}
        </Button>
      ))}
      {a?.canFold && (
        <Button disabled={busy} variant="ghost" onClick={run(onFold)} className="h-11 rounded-2xl px-3 text-sm font-bold text-violet-100">
          Ir ao baralho
        </Button>
      )}
      {flor && <p className="w-full text-center text-xs font-semibold text-fuchsia-200">Você tem flor! Cantar é opcional — se jogar a primeira carta sem cantar, perde a flor.</p>}
    </div>
  );
}

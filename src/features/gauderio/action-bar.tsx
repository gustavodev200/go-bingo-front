'use client';

import { GAUD_CALL_LABEL, gaudCallKind, type GaudCall, type GaudPending, type GaudPrivateHand } from '@/contracts';
import { Button } from '@/components/ui/button';
import { useBusy } from '@/features/truco/action-bar';
import { cn } from '@/lib/utils';
import { callButtonLabel } from './view';

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
 * (`hand.actions`), então só aparece o que vale agora.
 */
export function ActionBar({
  hand,
  pending,
  pendingIsOurs,
  turnName,
  onCall,
  onRespond,
  onFold,
}: {
  hand: GaudPrivateHand | null;
  pending: GaudPending | null;
  /** Nós cantamos e esperamos a resposta. */
  pendingIsOurs: boolean;
  turnName: string | null;
  onCall(call: GaudCall): Promise<unknown>;
  onRespond(accept: boolean): Promise<unknown>;
  onFold(): Promise<unknown>;
}) {
  const { busy, run } = useBusy();
  const a = hand?.actions;
  const calls = a?.calls ?? [];
  const callButtons = calls.map((call) => (
    <Button key={call} disabled={busy} onClick={run(() => onCall(call))} className={cn(shoutButton, CALL_TONE[gaudCallKind(call)])}>
      {callButtonLabel(call)}
    </Button>
  ));

  if (pending && a && (a.canAccept || a.canDecline || calls.length > 0) && !pendingIsOurs) {
    return (
      <div className="flex flex-col items-center gap-1.5" role="group" aria-label="Responder canto">
        <p className="text-center text-sm font-bold text-amber-200">Cantaram {GAUD_CALL_LABEL[pending.call]}! O que você responde?</p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          {a.canAccept && (
            <Button disabled={busy} onClick={run(() => onRespond(true))} className={cn(shoutButton, 'from-emerald-300 to-emerald-600 text-white [--primary-shadow:var(--color-emerald-800)]')}>
              Quero
            </Button>
          )}
          {a.canDecline && (
            <Button disabled={busy} variant="secondary" onClick={run(() => onRespond(false))} className={shoutButton}>
              Não quero
            </Button>
          )}
          {callButtons}
        </div>
        {hand?.flor && calls.includes('flor') && <p className="text-xs font-semibold text-fuchsia-200">Você tem flor: cante a flor!</p>}
      </div>
    );
  }
  if (pending) return <Status>{pendingIsOurs ? `Esperando a resposta ao ${GAUD_CALL_LABEL[pending.call]}…` : `${GAUD_CALL_LABEL[pending.call]}! Esperando a resposta…`}</Status>;

  return (
    <div className="flex min-h-11 flex-wrap items-center justify-center gap-2">
      {a?.canFold || a?.canPlay ? (
        <span className="rounded-full bg-amber-300 px-3 py-1 text-sm font-black text-amber-950 shadow" role="status">
          Sua vez!
        </span>
      ) : (
        turnName && <Status>Vez de {turnName}</Status>
      )}
      {callButtons}
      {a?.canFold && (
        <Button disabled={busy} variant="ghost" onClick={run(onFold)} className="h-11 rounded-2xl px-3 text-sm font-bold text-violet-100">
          Ir ao baralho
        </Button>
      )}
      {hand?.flor && calls.includes('flor') && <p className="w-full text-center text-xs font-semibold text-fuchsia-200">Você tem flor: cante antes de jogar!</p>}
    </div>
  );
}

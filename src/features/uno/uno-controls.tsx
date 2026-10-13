'use client';

import { Hand } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useBusy } from '@/features/truco/action-bar';
import { cn } from '@/lib/utils';
import type { UnoActions } from './connection';
import type { UnoAvailable } from './rules-view';
import styles from './uno.module.css';

const shoutButton = 'h-12 rounded-2xl px-5 font-display text-lg font-black tracking-wide uppercase italic shadow-[0_4px_0_rgb(0_0_0/0.35)] active:translate-y-0.5 active:shadow-none';

function Status({ children }: { children: React.ReactNode }) {
  return (
    <p role="status" className="flex min-h-12 items-center justify-center text-center text-sm font-bold text-white drop-shadow">
      {children}
    </p>
  );
}

/** Turn status and the decisions the turn can ask for: challenge, take the cards, keep the drawn card. */
export function TurnControls({ available, actions, turnName }: { available: UnoAvailable; actions: UnoActions; turnName: string | null }) {
  const { busy, run } = useBusy();

  if (available.canChallenge)
    return (
      <div className="flex flex-wrap items-center justify-center gap-2" role="group" aria-label="Responder ao +4">
        <Button disabled={busy} onClick={run(actions.challenge)} className={cn(shoutButton, 'bg-linear-to-b from-rose-400 to-red-700 text-white')}>
          Desafiar
        </Button>
        <Button disabled={busy} variant="secondary" onClick={run(actions.draw)} className={shoutButton}>
          Comprar {available.pendingDraw}
        </Button>
      </div>
    );

  if (available.pendingDraw > 0)
    return (
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Status>Empilhe um +2/+4 ou compre {available.pendingDraw}</Status>
        <Button disabled={busy} variant="secondary" onClick={run(actions.draw)} className={shoutButton}>
          Comprar {available.pendingDraw}
        </Button>
      </div>
    );

  if (available.canPass)
    return (
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Status>Jogue a carta comprada ou passe</Status>
        <Button disabled={busy} variant="secondary" onClick={run(actions.pass)} className={shoutButton}>
          Passar
        </Button>
      </div>
    );

  if (available.myTurn)
    return (
      <div className="flex min-h-12 items-center justify-center">
        <span className={cn('font-display rounded-full bg-amber-300 px-4 py-1 text-base font-black text-red-700 italic shadow', styles.pulse)} role="status">
          Sua vez!
        </span>
      </div>
    );

  return turnName ? <Status>Vez de {turnName}</Status> : <Status> </Status>;
}

/** The big red UNO! button and the "caught you" button when someone forgot to call it. */
export function UnoButtons({ available, actions, exposedName }: { available: UnoAvailable; actions: UnoActions; exposedName: string | null }) {
  const { busy, run } = useBusy();
  return (
    <div className="flex flex-col items-center gap-2">
      {available.canCatch && exposedName && (
        <Button disabled={busy} onClick={run(actions.catchUno)} aria-label={`Pegar ${exposedName} sem UNO`} className={cn(shoutButton, 'h-10 gap-1 bg-linear-to-b from-amber-200 to-amber-500 px-3 text-sm text-red-800', styles.pulse)}>
          <Hand aria-hidden /> Pegou!
        </Button>
      )}
      <button
        type="button"
        disabled={!available.canCallUno || busy}
        onClick={run(actions.callUno)}
        className={cn(
          'font-display flex size-[clamp(56px,16vw,76px)] items-center justify-center rounded-full border-4 border-white bg-radial-[at_35%_30%] from-red-400 to-red-700 text-[clamp(1rem,4.5vw,1.4rem)] font-black text-amber-300 italic shadow-[0_5px_0_rgb(0_0_0/0.4)] transition outline-none focus-visible:ring-4 focus-visible:ring-amber-300 active:translate-y-1 active:shadow-none disabled:opacity-45 disabled:grayscale-[0.4]',
          available.canCallUno && styles.pulse,
        )}
        style={{ textShadow: '-1px 2px 0 #000' }}
      >
        UNO!
      </button>
    </div>
  );
}

'use client';

import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { WIN_PATTERN_LABELS } from '@/contracts';
import { cn } from '@/lib/utils';
import { CardGrid } from './card-grid';
import { DrawnBoard } from './drawn-board';
import { LastNumbers } from './last-numbers';
import { RemainingPanel } from './remaining-panel';
import { SoundToggle } from './sound-toggle';
import { selectCanClaim, selectIsSpectator, useGameStore } from './store';
import type { GameActions } from './use-game-connection';

/**
 * Layout: retrato = palco (topo) / cartela / barra fixa; paisagem = palco | cartela+barra.
 * A <section data-stage> recebe o canvas 3D; a bola da vez fica sempre em DOM no centro (3D só de cenário).
 */
export function GameView({
  actions,
  stage,
  muted,
  onToggleMute,
}: {
  actions: GameActions;
  /** Palco 3D (modo 3D); sem ele, a região mostra os últimos números em DOM. */
  stage?: ReactNode;
  muted: boolean;
  onToggleMute: (muted: boolean) => void;
}) {
  const snapshot = useGameStore((s) => s.snapshot)!;
  const canClaim = useGameStore(selectCanClaim);
  const spectator = useGameStore(selectIsSpectator);
  const winner = useGameStore((s) => s.winner);
  const myUserId = useGameStore((s) => s.myUserId)!;
  const drawn = snapshot.game?.drawn ?? [];
  const card = snapshot.myCard;

  return (
    <main className="grid h-[calc(100dvh-env(safe-area-inset-top))] grid-rows-[minmax(10rem,1fr)_minmax(0,auto)_auto] landscape:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] landscape:grid-rows-[minmax(0,1fr)_auto]">
      <section data-stage className={cn('relative flex items-center justify-center overflow-hidden landscape:row-span-2', !stage && 'p-2')}>
        {stage ? (
          <>
            <div className="absolute inset-0">{stage}</div>
            {/* Números em DOM por cima do 3D: nítidos em qualquer DPR (texto em textura 3D fica ilegível no celular).
                Na vitória somem visualmente para a câmera mostrar o boneco do vencedor (o anúncio continua para leitores de tela). */}
            {drawn.length > 0 && !winner && (
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_55%_50%_at_50%_45%,rgb(18_8_42/0.7),transparent_75%)]" />
            )}
            <LastNumbers drawn={drawn} className={cn('pointer-events-none relative', winner && 'sr-only')} />
          </>
        ) : (
          <LastNumbers drawn={drawn} />
        )}
        <p className="absolute bottom-2 left-2 rounded-full bg-black/40 px-2.5 py-1 text-xs font-semibold text-amber-200 backdrop-blur-sm">
          {WIN_PATTERN_LABELS[snapshot.winPattern]}
        </p>
        <div className="absolute top-2 right-2 flex gap-2">
          <DrawnBoard drawn={drawn} />
          <SoundToggle muted={muted} onChange={onToggleMute} />
        </div>
      </section>
      <section className="flex items-center overflow-y-auto px-3 py-2">
        {spectator && (
          <p className="glass mx-auto flex w-full max-w-md flex-col items-center gap-1 rounded-2xl px-4 py-6 text-center">
            <span aria-hidden className="text-3xl">
              👀
            </span>
            <strong className="font-display text-lg text-amber-200">Você está assistindo</strong>
            <span className="text-muted-foreground text-sm">A partida já tinha começado. Você entra na próxima rodada.</span>
          </p>
        )}
        {card && (
          <CardGrid
            grid={card.grid}
            marked={card.marked}
            drawn={new Set(drawn)}
            onMark={(index) => void actions.mark(index)}
          />
        )}
      </section>
      <footer className="flex gap-2 rounded-t-3xl border-t border-white/10 bg-violet-950/80 px-3 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur-md">
        <RemainingPanel remaining={snapshot.game?.remaining ?? {}} members={snapshot.members} myUserId={myUserId} />
        {spectator ? (
          <span className="font-display flex h-12 flex-1 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-lg font-semibold text-violet-200">
            Assistindo
          </span>
        ) : (
          <Button
            size="lg"
            className={cn(
              'font-display h-12 flex-1 rounded-xl text-2xl font-bold tracking-wider',
              canClaim && 'ring-4 ring-amber-300/60 motion-safe:animate-pulse',
            )}
            disabled={!canClaim}
            onClick={() => void actions.claim()}
          >
            BINGO!
          </Button>
        )}
      </footer>
    </main>
  );
}

'use client';

import type { ReactNode } from 'react';
import { toast } from 'sonner';
import { BingoBall } from '@/components/stage/stage';
import { Button } from '@/components/ui/button';
import { letterFor, WIN_PATTERN_LABELS } from '@/contracts';
import { cn } from '@/lib/utils';
import { CardGrid } from './card-grid';
import { DrawnBoard } from './drawn-board';
import { LastNumbers } from './last-numbers';
import { RemainingPanel } from './remaining-panel';
import { SoundToggle } from './sound-toggle';
import { selectCanClaim, useGameStore } from './store';
import type { GameActions } from './use-game-connection';

/**
 * Layout: retrato = palco (topo) / cartela / barra fixa; paisagem = palco | cartela+barra.
 * A <section data-stage> é onde o canvas 3D entra nos marcos M3/M4; hoje ela é o "modo 2D".
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
  const drawn = snapshot.game?.drawn ?? [];
  const card = snapshot.myCard;
  const current = drawn.at(-1);

  return (
    <main className="grid h-[calc(100dvh-env(safe-area-inset-top))] grid-rows-[minmax(10rem,1fr)_minmax(0,auto)_auto] landscape:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] landscape:grid-rows-[minmax(0,1fr)_auto]">
      <section data-stage className={cn('relative flex items-center justify-center overflow-hidden landscape:row-span-2', !stage && 'p-2')}>
        {stage ? (
          <>
            <div className="absolute inset-0">{stage}</div>
            {current !== undefined && (
              // Número visível na HUD na hora (o telão é cosmético e pode demorar a carregar); o anúncio fica no LastNumbers.
              <div data-testid="current-number" aria-hidden="true" className="absolute top-2 left-2">
                <BingoBall key={current} letter={letterFor(current)} className="animate-in zoom-in-50 w-16 duration-500" faceClassName="flex flex-col">
                  <span className="text-[10px] font-bold">{letterFor(current)}</span> <span className="font-display text-xl leading-none font-bold">{current}</span>
                </BingoBall>
              </div>
            )}
            <div className="sr-only">
              <LastNumbers drawn={drawn} />
            </div>
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
        {card && (
          <CardGrid
            grid={card.grid}
            marked={card.marked}
            drawn={new Set(drawn)}
            onMark={(index) => void actions.mark(index)}
            onLocked={(n) => toast(`${letterFor(n)} ${n} ainda não saiu`)}
          />
        )}
      </section>
      <footer className="flex gap-2 rounded-t-3xl border-t border-white/10 bg-violet-950/80 px-3 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur-md">
        <RemainingPanel remaining={snapshot.game?.remaining ?? {}} members={snapshot.members} />
        <Button
          size="lg"
          className={cn(
            "font-display h-12 flex-1 rounded-xl text-2xl font-bold tracking-wider",
            canClaim && "ring-4 ring-amber-300/60 motion-safe:animate-pulse",
          )}
          disabled={!canClaim}
          onClick={() => void actions.claim()}
        >
          BINGO!
        </Button>
      </footer>
    </main>
  );
}

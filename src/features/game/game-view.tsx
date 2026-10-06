'use client';

import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { letterFor } from '@/contracts';
import { CardGrid } from './card-grid';
import { LastNumbers } from './last-numbers';
import { RemainingPanel } from './remaining-panel';
import { selectCanClaim, useGameStore } from './store';
import type { GameActions } from './use-game-connection';

/**
 * Layout: retrato = palco (topo) / cartela / barra fixa; paisagem = palco | cartela+barra.
 * A <section data-stage> é onde o canvas 3D entra nos marcos M3/M4; hoje ela é o "modo 2D".
 */
export function GameView({ actions }: { actions: GameActions }) {
  const snapshot = useGameStore((s) => s.snapshot)!;
  const canClaim = useGameStore(selectCanClaim);
  const drawn = snapshot.game?.drawn ?? [];
  const card = snapshot.myCard;

  return (
    <main className="grid h-[calc(100dvh-env(safe-area-inset-top))] grid-rows-[minmax(0,2fr)_minmax(0,3fr)_auto] landscape:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] landscape:grid-rows-[minmax(0,1fr)_auto]">
      <section data-stage className="flex items-center justify-center overflow-hidden p-2 landscape:row-span-2">
        <LastNumbers drawn={drawn} />
      </section>
      <section className="flex items-center overflow-y-auto px-3">
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
      <footer className="bg-background/95 flex gap-2 border-t px-3 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <RemainingPanel remaining={snapshot.game?.remaining ?? {}} members={snapshot.members} />
        <Button size="lg" className="h-12 flex-1 text-lg font-black" disabled={!canClaim} onClick={() => void actions.claim()}>
          BINGO!
        </Button>
      </footer>
    </main>
  );
}

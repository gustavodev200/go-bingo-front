'use client';

import { Button } from '@/components/ui/button';
import { MAX_CARD_REGENS } from '@/contracts';
import { CardGrid } from './card-grid';
import type { GameActions } from './use-game-connection';
import { MembersList } from './members-list';
import { ShareCode } from './share-code';
import { selectIsHost, selectReadyCount, useGameStore } from './store';

const NO_DRAWS: ReadonlySet<number> = new Set();

export function LobbyView({ actions, onLeave }: { actions: GameActions; onLeave: () => void }) {
  const snapshot = useGameStore((s) => s.snapshot)!;
  const myUserId = useGameStore((s) => s.myUserId)!;
  const isHost = useGameStore(selectIsHost);
  const ready = useGameStore(selectReadyCount);
  const canStart = snapshot.members.length >= 2 && ready >= 2;

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
      <header>
        <h1 className="text-xl font-bold">{snapshot.name}</h1>
        <p className="text-muted-foreground text-sm">
          {snapshot.members.length}/{snapshot.maxPlayers} jogadores · {ready} prontos
        </p>
      </header>
      <ShareCode code={snapshot.code} />
      <MembersList members={snapshot.members} hostId={snapshot.hostId} myUserId={myUserId} onKick={isHost ? (id) => void actions.kick(id) : undefined} />

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">Sua cartela</h2>
        {snapshot.myCard ? (
          <CardGrid grid={snapshot.myCard.grid} marked={[]} drawn={NO_DRAWS} />
        ) : (
          <p className="text-muted-foreground text-sm">Gere uma cartela para ficar pronto. Se não gerar, recebe uma automática no início.</p>
        )}
        <Button variant="secondary" className="h-11" onClick={() => void actions.generateCard()}>
          {snapshot.myCard ? `Trocar cartela (até ${MAX_CARD_REGENS}x)` : 'Gerar cartela'}
        </Button>
      </section>

      {isHost ? (
        <div className="flex flex-col gap-2">
          <Button size="lg" className="h-12" disabled={!canStart} onClick={() => void actions.start()}>
            {canStart ? 'Iniciar partida' : 'Aguardando 2 jogadores prontos'}
          </Button>
          <Button variant="ghost" className="text-destructive h-11" onClick={() => void actions.cancel()}>
            Cancelar sala
          </Button>
        </div>
      ) : (
        <Button variant="ghost" className="h-11" onClick={onLeave}>
          Sair da sala
        </Button>
      )}
    </main>
  );
}

'use client';

import { Coin, Coins } from '@/components/stage/coin';
import { Button } from '@/components/ui/button';
import { CARD_COST, DAILY_COINS, MAX_CARD_REGENS, WIN_COINS, WIN_PATTERN_LABELS } from '@/contracts';
import { CardGrid } from './card-grid';
import type { GameActions } from './use-game-connection';
import { MembersList } from './members-list';
import { ShareCode } from './share-code';
import { selectIsHost, selectReadyCount, useGameStore } from './store';

const NO_DRAWS: ReadonlySet<number> = new Set();

/** `coins` = saldo do jogador (cada cartela custa CARD_COST). */
export function LobbyView({ actions, onLeave, coins }: { actions: GameActions; onLeave: () => void; coins: number }) {
  const snapshot = useGameStore((s) => s.snapshot)!;
  const myUserId = useGameStore((s) => s.myUserId)!;
  const isHost = useGameStore(selectIsHost);
  const ready = useGameStore(selectReadyCount);
  const canStart = snapshot.members.length >= 2 && ready >= 2;
  const canBuyCard = coins >= CARD_COST;

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
      <header className="text-center">
        <h1 className="font-display text-marquee text-3xl font-bold">{snapshot.name}</h1>
        <p className="text-muted-foreground text-sm">
          {snapshot.members.length}/{snapshot.maxPlayers} jogadores · {ready} prontos
        </p>
        <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-amber-300/15 px-3 py-1 text-sm text-amber-200 ring-1 ring-amber-300/30">
          Modo: <strong>{WIN_PATTERN_LABELS[snapshot.winPattern]}</strong> · prêmio <Coins amount={WIN_COINS[snapshot.winPattern]} />
        </p>
      </header>
      <ShareCode code={snapshot.code} />

      <section className="glass flex flex-col gap-3 p-4">
        <h2 className="font-display text-lg font-semibold">Plateia</h2>
        <MembersList members={snapshot.members} hostId={snapshot.hostId} myUserId={myUserId} onKick={isHost ? (id) => void actions.kick(id) : undefined} />
      </section>

      <section className="glass flex flex-col gap-3 p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Sua cartela</h2>
          <Coins amount={coins} className="rounded-full bg-amber-300/15 px-2.5 py-1 text-sm text-amber-200 ring-1 ring-amber-300/30" />
        </div>
        {snapshot.myCard ? (
          <CardGrid grid={snapshot.myCard.grid} marked={[]} drawn={NO_DRAWS} />
        ) : (
          <p className="text-muted-foreground rounded-2xl border border-dashed border-white/15 px-4 py-6 text-center text-sm">
            Gere uma cartela para ficar pronto. Se não gerar, recebe uma automática no início ({CARD_COST} moedas se tiver saldo; senão, de graça).
          </p>
        )}
        <Button variant="secondary" className="h-11 gap-2 rounded-xl" disabled={!canBuyCard} onClick={() => void actions.generateCard()}>
          {snapshot.myCard ? `Trocar cartela (até ${MAX_CARD_REGENS}x)` : 'Gerar cartela'}
          <span className="flex items-center gap-1 rounded-full bg-black/25 px-2 py-0.5 text-xs">
            <Coin className="size-3.5" />
            <span aria-hidden>{CARD_COST}</span>
            <span className="sr-only">, custa {CARD_COST} moedas</span>
          </span>
        </Button>
        {!canBuyCard && (
          <p role="status" className="text-center text-xs text-amber-200/80">
            Sem moedas para trocar agora — você ainda joga: no início recebe uma cartela de graça. Volte amanhã para o bônus do dia (+{DAILY_COINS}).
          </p>
        )}
      </section>

      {isHost ? (
        <div className="flex flex-col gap-2">
          <Button size="lg" className="font-display h-14 rounded-2xl text-xl" disabled={!canStart} onClick={() => void actions.start()}>
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

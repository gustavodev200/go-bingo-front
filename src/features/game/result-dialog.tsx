'use client';

import { Coins } from '@/components/stage/coin';
import { Button } from '@/components/ui/button';
import { LOSS_COINS } from '@/contracts';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { UpgradeButton } from '@/features/auth/upgrade-button';
import { useProfile } from '@/features/profile/profile-context';
import { selectIsHost, useGameStore } from './store';

function myWinText(isGuest: boolean, points: number): string {
  if (isGuest) return 'Convidados não pontuam no ranking.';
  if (points > 0) return `+${points} pontos no ranking.`;
  // O back só pontua vitória sobre outro jogador logado (evita inflar o ranking contra convidados).
  return 'Só vitória contra outro jogador logado pontua no ranking.';
}

export function ResultDialog({ onReplay, onLeave }: { onReplay: () => void; onLeave: () => void }) {
  const { profile } = useProfile();
  const winner = useGameStore((s) => s.winner);
  const isHost = useGameStore(selectIsHost);
  const iWon = winner?.userId === profile.id;

  const title = winner ? (iWon ? 'Você venceu! 🎉' : `${winner.nickname} fez BINGO!`) : 'Fim de jogo';
  const description = !winner ? 'Todos os números saíram sem vencedor.' : iWon ? myWinText(profile.isGuest, winner.pointsAwarded) : 'Não foi dessa vez.';

  return (
    <Dialog open>
      <DialogContent showCloseButton={false} onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="text-marquee text-2xl">{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {winner && (
          <p className="flex items-center justify-center gap-2 rounded-2xl bg-white/5 py-3 text-lg">
            {iWon ? (
              <Coins amount={winner.coinsAwarded} signed className="text-amber-300" />
            ) : (
              // perda limitada ao saldo: nunca fica negativo
              <Coins amount={-LOSS_COINS} signed className="text-rose-300" />
            )}
          </p>
        )}
        {iWon && profile.isGuest && <UpgradeButton />}
        <div className="flex flex-col gap-2">
          {isHost ? (
            <Button size="lg" className="h-12" onClick={onReplay}>
              Jogar de novo
            </Button>
          ) : (
            <p className="text-muted-foreground text-sm">Aguardando o host começar outra rodada…</p>
          )}
          <Button variant="outline" className="h-11" onClick={onLeave}>
            Sair
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

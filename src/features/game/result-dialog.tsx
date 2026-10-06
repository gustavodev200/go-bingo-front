'use client';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { UpgradeButton } from '@/features/auth/upgrade-button';
import { useProfile } from '@/features/profile/profile-context';
import { selectIsHost, useGameStore } from './store';

export function ResultDialog({ onReplay, onLeave }: { onReplay: () => void; onLeave: () => void }) {
  const { profile } = useProfile();
  const winner = useGameStore((s) => s.winner);
  const isHost = useGameStore(selectIsHost);
  const iWon = winner?.userId === profile.id;

  const title = winner ? (iWon ? 'Você venceu! 🎉' : `${winner.nickname} fez BINGO!`) : 'Fim de jogo';
  const description = winner
    ? iWon
      ? profile.isGuest
        ? 'Convidados não pontuam no ranking.'
        : `+${winner.pointsAwarded} pontos no ranking.`
      : 'Não foi dessa vez.'
    : 'Todos os números saíram sem vencedor.';

  return (
    <Dialog open>
      <DialogContent showCloseButton={false} onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
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

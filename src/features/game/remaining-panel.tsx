'use client';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import type { Member } from '@/contracts';
import { cn } from '@/lib/utils';

function badge(left: number): string {
  if (left === 0) return 'Completa!';
  if (left === 1) return 'Por 1!';
  return `Faltam ${left}`;
}

export function RemainingPanel({ remaining, members, myUserId }: { remaining: Record<string, number>; members: Member[]; myUserId: string }) {
  const names = new Map(members.map((m) => [m.userId, m.nickname]));
  const rows = Object.entries(remaining).sort(([, a], [, b]) => a - b);
  // Espectador (sem cartela) não aparece no mapa: o gatilho fica só com o rótulo.
  const mine = remaining[myUserId] as number | undefined;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="lg"
          className="h-12 gap-2 rounded-xl"
          aria-label={mine === undefined ? 'Pedras que faltam' : `Pedras que faltam (você: ${badge(mine).toLowerCase()})`}
        >
          Pedras
          {mine !== undefined && (
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-xs font-bold',
                mine <= 1 ? 'bg-amber-300 text-violet-950' : 'bg-white/15 text-violet-100',
              )}
            >
              {badge(mine)}
            </span>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pedras que faltam</DialogTitle>
        </DialogHeader>
        <ol className="flex flex-col gap-1">
          {rows.map(([userId, left]) => (
            <li
              key={userId}
              className={cn(
                'flex justify-between rounded px-3 py-2',
                left === 1 && 'bg-amber-400/20 font-semibold text-amber-200',
                userId === myUserId && 'ring-1 ring-amber-300/60',
              )}
            >
              <span>
                {names.get(userId) ?? 'Jogador que saiu'}
                {userId === myUserId && ' (você)'}
              </span>
              <span>{left === 1 ? 'por 1!' : left}</span>
            </li>
          ))}
        </ol>
      </DialogContent>
    </Dialog>
  );
}

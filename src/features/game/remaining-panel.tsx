'use client';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import type { Member } from '@/contracts';

export function RemainingPanel({ remaining, members }: { remaining: Record<string, number>; members: Member[] }) {
  const names = new Map(members.map((m) => [m.userId, m.nickname]));
  const rows = Object.entries(remaining).sort(([, a], [, b]) => a - b);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="lg" className="h-12 rounded-xl">
          Pedras que faltam
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pedras que faltam</DialogTitle>
        </DialogHeader>
        <ol className="flex flex-col gap-1">
          {rows.map(([userId, left]) => (
            <li key={userId} className={`flex justify-between rounded px-3 py-2 ${left === 1 ? 'bg-amber-400/20 font-semibold text-amber-200' : ''}`}>
              <span>{names.get(userId) ?? 'Jogador que saiu'}</span>
              <span>{left === 1 ? 'por 1!' : left}</span>
            </li>
          ))}
        </ol>
      </DialogContent>
    </Dialog>
  );
}

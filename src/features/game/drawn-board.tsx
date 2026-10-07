'use client';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

const LETTERS = ['B', 'I', 'N', 'G', 'O'] as const;

/** Painel 1–75 na HUD (telas pequenas e leitores de tela; no 3D ele também está no telão). */
export function DrawnBoard({ drawn }: { drawn: readonly number[] }) {
  const lit = new Set(drawn);
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm" className="h-9">
          Painel
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Números sorteados ({drawn.length}/75)
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          {LETTERS.map((letter, row) => (
            <div key={letter} className="flex items-center gap-1.5">
              <span className="text-primary w-5 text-center font-black" aria-hidden="true">
                {letter}
              </span>
              <ol className="grid flex-1 grid-cols-[repeat(15,minmax(0,1fr))] gap-0.5" aria-label={`Coluna ${letter}`}>
                {Array.from({ length: 15 }, (_, i) => row * 15 + i + 1).map((n) => (
                  <li
                    key={n}
                    data-drawn={lit.has(n)}
                    className={cn('rounded py-0.5 text-center text-[10px] font-bold tabular-nums', lit.has(n) ? 'bg-amber-300 text-violet-950 shadow-[0_0_8px_rgb(251_191_36/0.7)]' : 'bg-white/5 text-muted-foreground')}
                  >
                    {n}
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

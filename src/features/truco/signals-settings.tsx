'use client';

import { Eye, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { TRUCO_GESTURES } from '@/contracts';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DEFAULT_CONVENTIONS, GESTURES, loadConventions, MEANINGS, saveConventions, type Conventions, type Meaning } from './signals';

/** Reads and edits the signal conventions stored on this device. */
export function useConventions(): [Conventions, (next: Conventions) => void] {
  const [conventions, setState] = useState<Conventions>(() => (typeof window === 'undefined' ? DEFAULT_CONVENTIONS : loadConventions()));
  return [
    conventions,
    (next) => {
      saveConventions(next);
      setState(next);
    },
  ];
}

export function SignalsSettings({ conventions, onChange }: { conventions: Conventions; onChange(next: Conventions): void }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-violet-100">
        Combine com seu parceiro o que cada gesto quer dizer. O gesto chega só para ele; o significado fica guardado neste aparelho e nunca vai para o servidor. Os adversários só percebem que você fez uma careta.
      </p>
      <ul className="flex flex-col gap-2">
        {TRUCO_GESTURES.map((g) => (
          <li key={g} className="flex items-center gap-3 rounded-2xl bg-white/5 p-2 ring-1 ring-white/10">
            <span aria-hidden className="text-3xl leading-none">
              {GESTURES[g].emoji}
            </span>
            <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm font-semibold">
              {GESTURES[g].label}
              <select
                value={conventions[g]}
                onChange={(e) => onChange({ ...conventions, [g]: e.target.value as Meaning })}
                className="h-10 rounded-xl border border-white/15 bg-violet-950/80 px-2 text-sm font-normal text-white"
              >
                {MEANINGS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
          </li>
        ))}
      </ul>
      <Button variant="ghost" className="h-10 gap-2 self-start rounded-xl text-violet-200" onClick={() => onChange({ ...DEFAULT_CONVENTIONS })}>
        <RotateCcw aria-hidden className="size-4" /> Voltar ao padrão
      </Button>
    </div>
  );
}

/** Same settings without leaving the table (navigating away would drop the connection). */
export function SignalsDialog({ conventions, onChange }: { conventions: Conventions; onChange(next: Conventions): void }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" className="h-11 gap-1 rounded-xl text-amber-200">
          <Eye aria-hidden className="size-4" /> Sinais secretos
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Sinais secretos</DialogTitle>
          <DialogDescription>Convenções da sua dupla</DialogDescription>
        </DialogHeader>
        <SignalsSettings conventions={conventions} onChange={onChange} />
      </DialogContent>
    </Dialog>
  );
}

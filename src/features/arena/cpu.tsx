'use client';

import { Bot, X } from 'lucide-react';
import { CPU_DAILY_CAP, CPU_PLAY_COINS, CPU_WIN_COINS } from '@/contracts';
import { Coins } from '@/components/stage/coin';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** O que vale uma partida com CPU na mesa: treino, sem ranking nem aposta, só um agrado fixo. */
export function CpuNote({ variant = 'dark', className }: { variant?: 'dark' | 'light'; className?: string }) {
  const light = variant === 'light';
  return (
    <p
      role="note"
      className={cn(
        'flex flex-wrap items-center justify-center gap-x-1 rounded-2xl px-3 py-2 text-center text-xs',
        light ? 'border-2 border-black bg-white/90 text-slate-900' : 'bg-sky-300/10 text-sky-100 ring-1 ring-sky-300/25',
        className,
      )}
    >
      <Bot aria-hidden className="size-4 shrink-0" />
      <span>
        <strong>Mesa com CPU:</strong> não vale ranking nem aposta. Vitória <Coins amount={CPU_WIN_COINS} className="align-middle" />, derrota <Coins amount={CPU_PLAY_COINS} className="align-middle" /> (até {CPU_DAILY_CAP} partidas pagas por dia).
      </span>
    </p>
  );
}

/** Lugar vago: o anfitrião chama a CPU para sentar ali. */
export function AddCpuButton({ onAdd, disabled, className }: { onAdd(): unknown; disabled?: boolean; className?: string }) {
  return (
    <Button type="button" size="sm" variant="secondary" disabled={disabled} className={cn('h-9 gap-1 rounded-xl font-bold', className)} onClick={() => void onAdd()}>
      <Bot aria-hidden className="size-4" /> + CPU
    </Button>
  );
}

/** Tira a CPU do lugar (só o anfitrião, no lobby). */
export function RemoveCpuButton({ name, onRemove, className }: { name: string; onRemove(): unknown; className?: string }) {
  return (
    <button type="button" aria-label={`Tirar ${name}`} onClick={() => void onRemove()} className={cn('grid size-7 place-items-center rounded-full bg-white/90 text-slate-900 ring-1 ring-black/20', className)}>
      <X aria-hidden className="size-4" />
    </button>
  );
}

export function CpuTag({ className }: { className?: string }) {
  return <span className={cn('rounded-md bg-sky-400 px-1.5 text-[10px] font-black text-sky-950', className)}>CPU</span>;
}

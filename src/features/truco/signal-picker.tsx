'use client';

import { Eye } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { TRUCO_GESTURES, type TrucoGesture } from '@/contracts';
import { Button } from '@/components/ui/button';
import { GESTURES, type Conventions } from './signals';

/** Secret signals: only the partner learns which gesture it was; its meaning comes from the local conventions. */
export function SignalPicker({ conventions, onSend }: { conventions: Conventions; onSend(gesture: TrucoGesture): Promise<unknown> }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: KeyboardEvent | PointerEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('keydown', close);
    window.addEventListener('pointerdown', close);
    return () => {
      window.removeEventListener('keydown', close);
      window.removeEventListener('pointerdown', close);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <Button variant="secondary" size="icon" className="size-12 rounded-2xl" aria-expanded={open} aria-label="Sinal secreto para o parceiro" onClick={() => setOpen((v) => !v)}>
        <Eye aria-hidden className="size-6" />
      </Button>
      {open && (
        <div role="menu" aria-label="Sinais secretos" className="glass absolute bottom-14 left-0 z-40 flex w-64 flex-col gap-1 p-2">
          <p className="px-2 pt-1 text-xs font-semibold text-violet-200">Só seu parceiro sabe o que significa</p>
          {TRUCO_GESTURES.map((g) => (
            <button
              key={g}
              role="menuitem"
              type="button"
              className="flex items-center gap-2 rounded-xl px-2 py-2 text-left text-sm hover:bg-white/10 focus-visible:bg-white/10 focus-visible:outline-none"
              onClick={() => {
                setOpen(false);
                void onSend(g);
              }}
            >
              <span className="text-2xl leading-none">{GESTURES[g].emoji}</span>
              <span className="flex min-w-0 flex-col">
                <span className="font-semibold">{GESTURES[g].label}</span>
                <span className="truncate text-xs text-violet-200">{conventions[g]}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

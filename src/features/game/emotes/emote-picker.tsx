'use client';

import { SmilePlus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { EMOTE_SYMBOLS, EMOTES, type Emote } from '@/contracts';
import { cn } from '@/lib/utils';
import { EMOTE_LABELS } from './labels';

/** Igual ao limite do servidor: evita toques que ele recusaria. */
export const EMOTE_COOLDOWN_MS = 1500;

/** Botão "Reagir" que abre os 4 emotes. `className` posiciona a fileira (padrão: abaixo, à direita). */
export function EmotePicker({ onEmote, className }: { onEmote: (emote: Emote) => void; className?: string }) {
  const [open, setOpen] = useState(false);
  const [coolingDown, setCoolingDown] = useState(false);

  useEffect(() => {
    if (!coolingDown) return;
    const timer = setTimeout(() => setCoolingDown(false), EMOTE_COOLDOWN_MS);
    return () => clearTimeout(timer);
  }, [coolingDown]);

  function send(emote: Emote) {
    onEmote(emote);
    navigator.vibrate?.(8);
    setOpen(false);
    setCoolingDown(true);
  }

  return (
    <div className="relative">
      <Button
        variant="secondary"
        size="icon"
        className="size-9"
        aria-label="Reagir"
        aria-expanded={open}
        disabled={coolingDown}
        onClick={() => setOpen((o) => !o)}
      >
        <SmilePlus aria-hidden />
      </Button>
      {open && (
        <div
          role="group"
          aria-label="Reações"
          onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
          className={cn(
            'absolute top-full right-0 z-20 mt-2 flex gap-1 rounded-full border border-amber-300/40 bg-violet-950/90 p-1 shadow-lg backdrop-blur-md',
            'motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95',
            className,
          )}
        >
          {EMOTES.map((emote) => (
            <button
              key={emote}
              type="button"
              aria-label={EMOTE_LABELS[emote]}
              onClick={() => send(emote)}
              className="grid size-11 place-items-center rounded-full text-2xl transition hover:bg-white/10 active:scale-90"
            >
              <span aria-hidden>{EMOTE_SYMBOLS[emote]}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

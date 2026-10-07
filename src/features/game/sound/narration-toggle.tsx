'use client';

import { Speech } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { sharedNarrator, type Narrator } from './narration';

/** Liga/desliga a narração das bolas. Ligar fala uma frase: confirma e destrava a voz no iOS (exige gesto). */
export function NarrationToggle({ enabled, onChange, narrator = sharedNarrator() }: { enabled: boolean; onChange: (enabled: boolean) => void; narrator?: Narrator }) {
  if (!narrator.supported) return null;
  return (
    <Button
      variant="secondary"
      size="icon"
      className={cn('size-9', !enabled && 'opacity-60')}
      aria-pressed={enabled}
      aria-label={enabled ? 'Desligar narração' : 'Ligar narração'}
      onClick={() => {
        if (!enabled) narrator.speak('Narração ligada');
        onChange(!enabled);
      }}
    >
      <Speech aria-hidden="true" />
    </Button>
  );
}

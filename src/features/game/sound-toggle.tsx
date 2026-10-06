'use client';

import { Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function SoundToggle({ muted, onChange }: { muted: boolean; onChange: (muted: boolean) => void }) {
  return (
    <Button variant="secondary" size="icon" className="size-9" aria-pressed={muted} aria-label={muted ? 'Ligar som' : 'Desligar som'} onClick={() => onChange(!muted)}>
      {muted ? <VolumeX aria-hidden="true" /> : <Volume2 aria-hidden="true" />}
    </Button>
  );
}

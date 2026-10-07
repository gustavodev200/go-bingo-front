'use client';

import { Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

export function ShareCode({ code }: { code: string }) {
  async function share() {
    const url = `${window.location.origin}/${code}`;
    if (navigator.share) {
      await navigator.share({ title: 'Go Bingo', text: `Bora jogar bingo! Sala ${code}`, url }).catch(() => undefined);
      return;
    }
    await navigator.clipboard.writeText(url);
    toast.success('Link da sala copiado!');
  }

  return (
    <div className="glass flex items-center justify-between gap-3 rounded-2xl border-dashed border-amber-300/40 px-4 py-3">
      <p className="flex flex-col">
        <span className="text-xs font-semibold tracking-[0.25em] text-pink-300 uppercase">Código</span>{' '}
        <strong className="font-mono text-2xl font-bold tracking-[0.3em] text-amber-300 drop-shadow-[0_0_10px_rgb(251_191_36/0.5)]">{code}</strong>
      </p>
      <Button variant="outline" className="h-11 gap-2 rounded-xl" onClick={() => void share()}>
        <Share2 aria-hidden />
        Compartilhar
      </Button>
    </div>
  );
}

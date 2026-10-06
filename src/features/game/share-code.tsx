'use client';

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
    <div className="flex items-center justify-between gap-2">
      <p>
        Código <strong className="font-mono text-xl tracking-widest">{code}</strong>
      </p>
      <Button variant="outline" className="h-11" onClick={() => void share()}>
        Compartilhar
      </Button>
    </div>
  );
}

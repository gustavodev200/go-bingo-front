'use client';

import { Share } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useInstallPrompt } from './use-install-prompt';

export function InstallBanner() {
  const { mode, install, dismiss } = useInstallPrompt();
  if (mode === 'hidden') return null;

  return (
    <aside className="glass flex flex-col gap-3 p-4" aria-label="Instalar o aplicativo">
      <p className="font-display text-lg font-semibold">Instale o Go Bingo</p>
      {mode === 'prompt' ? (
        <>
          <p className="text-muted-foreground text-sm">Abra direto da tela inicial, em tela cheia.</p>
          <div className="flex gap-2">
            <Button className="h-11 flex-1" onClick={() => void install()}>
              Instalar
            </Button>
            <Button variant="outline" className="h-11" onClick={dismiss}>
              Agora não
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="text-muted-foreground flex flex-wrap items-center gap-1 text-sm">
            Toque em <Share className="inline size-4" aria-hidden="true" /> <strong>Compartilhar</strong> e depois em{' '}
            <strong>Adicionar à Tela de Início</strong>.
          </p>
          <Button variant="outline" className="h-11 self-start" onClick={dismiss}>
            Fechar
          </Button>
        </>
      )}
    </aside>
  );
}

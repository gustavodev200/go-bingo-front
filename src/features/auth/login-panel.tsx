'use client';

import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { chromeIntentUrl, isInAppBrowser } from '@/lib/in-app-browser';
import { createClient } from '@/lib/supabase/client';
import { GuestButton } from './guest-button';

export function LoginPanel({ userAgent, next }: { userAgent: string; next: string }) {
  const embedded = isInAppBrowser(userAgent);

  async function signInWithGoogle() {
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
    const { error } = await createClient().auth.signInWithOAuth({ provider: 'google', options: { redirectTo } });
    if (error) toast.error('Não foi possível entrar com Google. Tente novamente.');
  }

  async function copyLink() {
    await navigator.clipboard.writeText(window.location.href);
    toast.success('Link copiado! Cole no Chrome ou Safari.');
  }

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-4 px-4 py-10">
      <h1 className="text-center text-3xl font-bold">Go Bingo</h1>
      {embedded ? (
        <div className="rounded-lg border p-4 text-sm" role="note">
          <p className="font-medium">Abra no navegador para entrar com Google</p>
          <p className="text-muted-foreground mt-1">O Google não permite login dentro deste app. Você ainda pode jogar como convidado.</p>
          <div className="mt-3 flex gap-2">
            <Button variant="outline" onClick={() => void copyLink()}>
              Copiar link
            </Button>
            {/Android/i.test(userAgent) && (
              <Button asChild variant="outline">
                <a href={chromeIntentUrl(typeof window === 'undefined' ? 'https://localhost' : window.location.href)}>Abrir no Chrome</a>
              </Button>
            )}
          </div>
        </div>
      ) : (
        <Button size="lg" className="w-full" onClick={() => void signInWithGoogle()}>
          Entrar com Google
        </Button>
      )}
      <GuestButton next={next} />
      <p className="text-muted-foreground text-center text-xs">Convidados jogam normalmente, mas não pontuam no ranking.</p>
    </div>
  );
}

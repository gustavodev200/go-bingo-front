'use client';

import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { isInAppBrowser } from '@/lib/in-app-browser';
import { createClient } from '@/lib/supabase/client';
import { GuestButton } from './guest-button';
import { OpenInBrowserNotice } from './open-in-browser';

export function LoginPanel({ userAgent, next }: { userAgent: string; next: string }) {
  const embedded = isInAppBrowser(userAgent);

  async function signInWithGoogle() {
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
    const { error } = await createClient().auth.signInWithOAuth({ provider: 'google', options: { redirectTo } });
    if (error) toast.error('Não foi possível entrar com Google. Tente novamente.');
  }

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-4 px-4 py-10">
      <h1 className="text-center text-3xl font-bold">Go Bingo</h1>
      {embedded ? (
        <OpenInBrowserNotice userAgent={userAgent} hint="Você ainda pode jogar como convidado." />
      ) : (
        <Button size="lg" className="h-11 w-full" onClick={() => void signInWithGoogle()}>
          Entrar com Google
        </Button>
      )}
      <GuestButton next={next} />
      <p className="text-muted-foreground text-center text-xs">Convidados jogam normalmente, mas não pontuam no ranking.</p>
    </div>
  );
}

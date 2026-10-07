'use client';

import { toast } from 'sonner';
import { ConfettiRain, MarqueeTitle, MiniGlobe } from '@/components/stage/stage';
import { Button } from '@/components/ui/button';
import { isInAppBrowser } from '@/lib/in-app-browser';
import { createClient } from '@/lib/supabase/client';
import { GoogleIcon } from './google-icon';
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
    <main className="relative flex min-h-dvh items-center justify-center">
      <ConfettiRain />
      <div className="mx-auto flex w-full max-w-sm flex-col items-center gap-5 px-4 py-8">
        <MiniGlobe />
        <MarqueeTitle />
        <p className="text-center text-sm font-medium text-violet-100/90">
          O globo já está girando. <span className="text-amber-300">Pegue sua cartela!</span>
        </p>

        <div className="animate-in fade-in slide-in-from-bottom-4 glass flex w-full flex-col gap-3 p-5 duration-700">
          {embedded ? (
            <OpenInBrowserNotice userAgent={userAgent} hint="Você ainda pode jogar como convidado." />
          ) : (
            <Button variant="google" size="lg" className="h-12 w-full gap-3 rounded-xl text-base" onClick={() => void signInWithGoogle()}>
              <GoogleIcon />
              Entrar com Google
            </Button>
          )}

          <div aria-hidden className="flex items-center gap-3 text-xs font-semibold tracking-widest text-violet-200/60 uppercase">
            <span className="h-px flex-1 bg-white/15" />
            ou
            <span className="h-px flex-1 bg-white/15" />
          </div>

          <GuestButton next={next} />
          <p className="text-center text-xs text-violet-200/70">Convidados jogam normalmente, mas não pontuam no ranking.</p>
        </div>
      </div>
    </main>
  );
}

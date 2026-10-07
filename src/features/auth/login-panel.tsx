'use client';

import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { isInAppBrowser } from '@/lib/in-app-browser';
import { createClient } from '@/lib/supabase/client';
import { GuestButton } from './guest-button';
import { LoginBackdrop, MarqueeTitle, MiniGlobe, sceneClass } from './login-stage';
import { OpenInBrowserNotice } from './open-in-browser';

function GoogleIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="size-5">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.06H2.18A11 11 0 0 0 1 12c0 1.78.43 3.45 1.18 4.94l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
    </svg>
  );
}

export function LoginPanel({ userAgent, next }: { userAgent: string; next: string }) {
  const embedded = isInAppBrowser(userAgent);

  async function signInWithGoogle() {
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
    const { error } = await createClient().auth.signInWithOAuth({ provider: 'google', options: { redirectTo } });
    if (error) toast.error('Não foi possível entrar com Google. Tente novamente.');
  }

  return (
    <main className={`${sceneClass} dark text-foreground relative flex min-h-dvh items-center justify-center`}>
      <LoginBackdrop />
      <div className="mx-auto flex w-full max-w-sm flex-col items-center gap-5 px-4 py-8">
        <MiniGlobe />
        <MarqueeTitle />
        <p className="text-center text-sm font-medium text-violet-100/90">
          O globo já está girando. <span className="text-amber-300">Pegue sua cartela!</span>
        </p>

        <div className="animate-in fade-in slide-in-from-bottom-4 flex w-full flex-col gap-3 rounded-3xl border border-white/10 bg-violet-950/55 p-5 shadow-[0_0_60px_-20px_rgb(245_158_11/0.6)] backdrop-blur-md duration-700">
          {embedded ? (
            <OpenInBrowserNotice userAgent={userAgent} hint="Você ainda pode jogar como convidado." />
          ) : (
            <Button
              size="lg"
              className="h-12 w-full gap-3 rounded-xl bg-white text-base font-semibold text-slate-800 shadow-lg hover:bg-violet-50"
              onClick={() => void signInWithGoogle()}
            >
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

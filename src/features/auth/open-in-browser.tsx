'use client';

import { useSyncExternalStore } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { chromeIntentUrl, isInAppBrowser } from '@/lib/in-app-browser';

const noopSubscribe = () => () => undefined;

/** true dentro de Instagram/Facebook/TikTok etc. No servidor (sem navigator) é false. */
export function useIsInAppBrowser(): boolean {
  return useSyncExternalStore(noopSubscribe, () => isInAppBrowser(navigator.userAgent), () => false);
}

/**
 * URL atual só no cliente: no servidor é null, então o intent nunca sai com host errado.
 * Depois da hidratação o React re-renderiza com o valor do cliente.
 */
function useCurrentHref(): string | null {
  return useSyncExternalStore(noopSubscribe, () => window.location.href, () => null);
}

/** Google bloqueia OAuth em navegador embutido (disallowed_useragent): orienta abrir no navegador. */
export function OpenInBrowserNotice({ userAgent, hint }: { userAgent: string; hint?: string }) {
  const href = useCurrentHref();

  async function copyLink() {
    await navigator.clipboard.writeText(window.location.href);
    toast.success('Link copiado! Cole no Chrome ou Safari.');
  }

  return (
    <div className="rounded-lg border p-4 text-sm" role="note">
      <p className="font-medium">Abra no navegador para entrar com Google</p>
      <p className="text-muted-foreground mt-1">O Google não permite login dentro deste app.{hint ? ` ${hint}` : ''}</p>
      <div className="mt-3 flex gap-2">
        <Button variant="outline" className="h-11" onClick={() => void copyLink()}>
          Copiar link
        </Button>
        {href && /Android/i.test(userAgent) && (
          <Button asChild variant="outline" className="h-11">
            <a href={chromeIntentUrl(href)}>Abrir no Chrome</a>
          </Button>
        )}
      </div>
    </div>
  );
}

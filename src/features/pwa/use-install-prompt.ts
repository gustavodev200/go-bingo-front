'use client';

import { useCallback, useEffect, useState } from 'react';
import { isInAppBrowser } from '@/lib/in-app-browser';
import { isIos, isStandalone } from '@/lib/pwa/platform';

export type InstallMode = 'hidden' | 'prompt' | 'ios';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const DISMISS_KEY = 'go-bingo:install-dismissed';

function wasDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

function rememberDismissal() {
  try {
    localStorage.setItem(DISMISS_KEY, '1');
  } catch {
    // Armazenamento bloqueado: some só nesta sessão.
  }
}

export function useInstallPrompt() {
  const [mode, setMode] = useState<InstallMode>('hidden');
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (isStandalone() || isInAppBrowser(navigator.userAgent) || wasDismissed()) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- detecção só existe no cliente
    if (isIos(navigator.userAgent, navigator.maxTouchPoints)) setMode('ios');

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
      setMode('prompt');
    };
    const onInstalled = () => {
      setDeferred(null);
      setMode('hidden');
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
    setMode('hidden');
  }, [deferred]);

  const dismiss = useCallback(() => {
    rememberDismissal();
    setMode('hidden');
  }, []);

  return { mode, install, dismiss };
}

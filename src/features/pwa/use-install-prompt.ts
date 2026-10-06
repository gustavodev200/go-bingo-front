'use client';

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { isInAppBrowser } from '@/lib/in-app-browser';
import { isIos, isStandalone } from '@/lib/pwa/platform';
import { clearDeferredInstall, getDeferredInstall, subscribeDeferredInstall } from './install-event';

export type InstallMode = 'hidden' | 'prompt' | 'ios';

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

type Env = { eligible: boolean; ios: boolean };

export function useInstallPrompt() {
  const [env, setEnv] = useState<Env>({ eligible: false, ios: false });
  const deferred = useSyncExternalStore(subscribeDeferredInstall, getDeferredInstall, () => null);

  useEffect(() => {
    const eligible = !isStandalone() && !isInAppBrowser(navigator.userAgent) && !wasDismissed();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- detecção só existe no cliente
    setEnv({ eligible, ios: isIos(navigator.userAgent, navigator.maxTouchPoints) });
  }, []);

  const install = useCallback(async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    clearDeferredInstall();
  }, [deferred]);

  const dismiss = useCallback(() => {
    rememberDismissal();
    setEnv((current) => ({ ...current, eligible: false }));
  }, []);

  let mode: InstallMode = 'hidden';
  if (env.eligible && deferred) mode = 'prompt';
  else if (env.eligible && env.ios) mode = 'ios';
  return { mode, install, dismiss };
}

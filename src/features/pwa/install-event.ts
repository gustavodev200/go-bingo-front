export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

/**
 * O Chrome dispara `beforeinstallprompt` uma vez por carregamento, muitas vezes antes de a Home hidratar
 * (ou numa rota de sala). O listener precisa existir desde o carregamento do módulo, não só quando a Home monta.
 */
let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferred = event as BeforeInstallPromptEvent;
    emit();
  });
  window.addEventListener('appinstalled', () => clearDeferredInstall());
}

export function subscribeDeferredInstall(listener: () => void) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

export function getDeferredInstall(): BeforeInstallPromptEvent | null {
  return deferred;
}

export function clearDeferredInstall() {
  deferred = null;
  emit();
}

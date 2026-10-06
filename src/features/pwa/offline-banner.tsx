'use client';

import { useOnlineStatus } from './use-online-status';

export function OfflineBanner() {
  const online = useOnlineStatus();
  if (online) return null;
  return (
    <div role="status" className="bg-destructive fixed inset-x-0 top-0 z-50 px-4 pt-[calc(0.5rem+env(safe-area-inset-top))] pb-2 text-center text-sm font-medium text-white">
      Você está offline. O jogo precisa de conexão.
    </div>
  );
}

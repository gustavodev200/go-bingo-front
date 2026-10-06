'use client';

import { useOnlineStatus } from './use-online-status';

export function OfflineBanner() {
  const online = useOnlineStatus();
  if (online) return null;
  return (
    <div role="status" className="bg-destructive px-4 py-2 text-center text-sm font-medium text-white">
      Você está offline. O jogo precisa de conexão.
    </div>
  );
}

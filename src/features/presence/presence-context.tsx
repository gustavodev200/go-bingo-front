'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { PRESENCE_NAMESPACE, PresenceServerEvents, presenceCountSchema } from '@/contracts';
import { createSocket } from '@/lib/socket';

const PresenceContext = createContext<number | null>(null);

/** Jogadores online na plataforma; null enquanto o servidor não respondeu. */
export function useOnlineCount(): number | null {
  return useContext(PresenceContext);
}

/** Mantém uma conexão em /presence enquanto o jogador está no app, para ser contado e saber quantos estão online. */
export function PresenceProvider({ children }: { children: ReactNode }) {
  const [online, setOnline] = useState<number | null>(null);

  useEffect(() => {
    const socket = createSocket(PRESENCE_NAMESPACE);
    socket.on(PresenceServerEvents.COUNT, (payload: unknown) => {
      const parsed = presenceCountSchema.safeParse(payload);
      if (parsed.success) setOnline(parsed.data.online);
    });
    socket.on('disconnect', () => setOnline(null));
    socket.connect();
    return () => {
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, []);

  return <PresenceContext.Provider value={online}>{children}</PresenceContext.Provider>;
}

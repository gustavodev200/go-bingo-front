'use client';

import { SerwistProvider } from '@serwist/turbopack/react';
import type { ReactNode } from 'react';
import './install-event'; // começa a escutar `beforeinstallprompt` assim que o app carrega

/**
 * `reloadOnOnline=false`: o padrão do Serwist recarrega a página a cada evento `online`, o que derrubaria o socket
 * e a partida numa queda curta de rede. `cacheOnNavigation=false`: não enviar URLs de páginas (dependem de sessão) ao SW.
 */
export function PwaProvider({ children }: { children: ReactNode }) {
  return (
    <SerwistProvider
      swUrl="/serwist/sw.js"
      disable={process.env.NODE_ENV === 'development'}
      reloadOnOnline={false}
      cacheOnNavigation={false}
    >
      {children}
    </SerwistProvider>
  );
}

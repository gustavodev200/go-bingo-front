'use client';

import dynamic from 'next/dynamic';

/** RNF-3D-01: three.js só é baixado dentro da sala. */
export const GameStageLazy = dynamic(() => import('./game-stage'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-gradient-to-b from-violet-950 to-fuchsia-900 text-sm text-violet-100" aria-hidden="true">
      Ligando o telão…
    </div>
  ),
});

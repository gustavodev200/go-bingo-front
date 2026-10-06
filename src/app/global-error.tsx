'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);
  return (
    <html lang="pt-BR">
      <body className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="text-2xl font-bold">Algo deu errado</h1>
        <button type="button" className="rounded-md border px-4 py-2" onClick={() => window.location.reload()}>
          Recarregar
        </button>
      </body>
    </html>
  );
}

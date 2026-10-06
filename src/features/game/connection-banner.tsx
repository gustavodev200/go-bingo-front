import type { ConnectionStatus } from './store';

export function ConnectionBanner({ status }: { status: ConnectionStatus }) {
  if (status !== 'reconnecting') return null;
  return (
    <div role="status" className="bg-amber-500 px-4 py-2 text-center text-sm font-medium text-black">
      Reconectando…
    </div>
  );
}

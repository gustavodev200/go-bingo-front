import type { ConnectionStatus } from './store';

export function ConnectionBanner({ status }: { status: ConnectionStatus }) {
  if (status !== 'reconnecting') return null;
  return (
    <div role="status" className="fixed inset-x-0 top-0 z-50 bg-amber-500 px-4 pt-[calc(0.5rem+env(safe-area-inset-top))] pb-2 text-center text-sm font-medium text-black">
      Reconectando…
    </div>
  );
}

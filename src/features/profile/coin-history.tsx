import { Coins } from '@/components/stage/coin';
import type { CoinEntry, CoinReason } from '@/contracts';
import { cn } from '@/lib/utils';

const REASON_LABELS: Record<CoinReason, string> = {
  WELCOME: 'Boas-vindas',
  DAILY: 'Bônus do dia',
  CARD: 'Cartela',
  WIN: 'Vitória',
  LOSS: 'Derrota',
};

const when = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

export function CoinHistory({ entries }: { entries: CoinEntry[] }) {
  if (entries.length === 0) return <p className="text-muted-foreground text-center text-sm">Nenhuma movimentação ainda.</p>;
  return (
    <ul aria-label="Extrato de moedas" className="flex flex-col gap-1.5">
      {entries.map((e) => (
        <li key={e.id} className="flex min-h-11 items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
          <span className="flex min-w-0 flex-col leading-tight">
            <span className="font-semibold">{REASON_LABELS[e.reason]}</span>
            <time dateTime={e.createdAt} className="text-muted-foreground text-xs">
              {when.format(new Date(e.createdAt))}
            </time>
          </span>
          <Coins amount={e.amount} signed className={cn(e.amount >= 0 ? 'text-amber-300' : 'text-rose-300')} />
        </li>
      ))}
    </ul>
  );
}

'use client';

import { Gift, Loader2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { DIAMOND_PACKS, DIAMOND_STREAK_DAYS, diamondClaimResponseSchema, diamondExchangeResponseSchema, diamondRewardFor, diamondStatusSchema, type DiamondStatus } from '@/contracts';
import { Coins } from '@/components/stage/coin';
import { Diamond, Diamonds } from '@/components/stage/diamond';
import { Button } from '@/components/ui/button';
import { useProfile } from '@/features/profile/profile-context';
import { ApiError, apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';

/** Bônus de cada pacote sobre o valor base (1 diamante = 50 moedas). */
function packBonus(pack: { diamonds: number; coins: number }): number {
  const base = DIAMOND_PACKS[0].coins / DIAMOND_PACKS[0].diamonds;
  return Math.round((pack.coins / (pack.diamonds * base) - 1) * 100);
}

/**
 * Cofre de diamantes no salão: resgate diário com o ciclo de 7 dias e a troca por moedas em pacotes.
 * Convidado vê o convite para entrar com a conta (diamante é só para conta logada).
 */
export function DiamondVault() {
  const { profile, refresh } = useProfile();
  const [status, setStatus] = useState<DiamondStatus | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setStatus(await apiFetch('/diamonds', diamondStatusSchema));
    } catch {
      setStatus(null);
    }
  }, []);

  useEffect(() => {
    // setState só acontece depois do await (assíncrono), não durante o effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function act(key: string, fn: () => Promise<void>) {
    if (busy) return;
    setBusy(key);
    try {
      await fn();
      await refresh();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Não deu certo, tente de novo');
    } finally {
      setBusy(null);
    }
  }

  const claim = () =>
    act('claim', async () => {
      const res = await apiFetch('/diamonds/claim', diamondClaimResponseSchema, { method: 'POST' });
      setStatus(res.status);
      if (res.claimed > 0) toast.success(`+${res.claimed} diamantes!`);
    });

  const exchange = (diamonds: number) =>
    act(`pack-${diamonds}`, async () => {
      const res = await apiFetch('/diamonds/exchange', diamondExchangeResponseSchema, { method: 'POST', body: JSON.stringify({ diamonds }) });
      setStatus(res.status);
      toast.success(`+${res.coins} moedas na carteira`);
    });

  if (profile.isGuest || status?.eligible === false) {
    return (
      <section aria-label="Diamantes" className="glass flex items-center gap-3 rounded-3xl p-4 text-sm">
        <Diamond className="size-8" />
        <p className="text-violet-100">
          Entre com sua conta para ganhar <strong className="text-cyan-200">10 diamantes por dia</strong> e trocar por moedas.
        </p>
      </section>
    );
  }

  const diamonds = status?.diamonds ?? profile.diamonds;
  const day = status?.streakDay ?? 0;
  const claimed = status?.claimedToday ?? false;

  return (
    <section aria-labelledby="vault-title" className="glass flex flex-col gap-3 rounded-3xl p-4">
      <header className="flex items-center justify-between gap-3">
        <h2 id="vault-title" className="font-display text-lg font-semibold">
          Cofre de diamantes
        </h2>
        <Diamonds amount={diamonds} className="rounded-full bg-cyan-300/15 px-2.5 py-1 text-sm text-cyan-100 ring-1 ring-cyan-300/30" />
      </header>

      <ol className="grid grid-cols-7 gap-1" aria-label={`Sequência: ${day} de ${DIAMOND_STREAK_DAYS} dias`}>
        {Array.from({ length: DIAMOND_STREAK_DAYS }, (_, i) => {
          const n = i + 1;
          const done = n <= day;
          const isNext = !claimed && n === day + 1;
          return (
            <li
              key={n}
              className={cn(
                'flex flex-col items-center gap-0.5 rounded-xl py-1.5 text-[10px] font-semibold ring-1',
                done ? 'bg-cyan-300/25 text-cyan-50 ring-cyan-300/50' : 'bg-white/5 text-violet-200/70 ring-white/10',
                isNext && 'ring-2 ring-amber-300',
              )}
            >
              <span>Dia {n}</span>
              {n === DIAMOND_STREAK_DAYS ? <Gift aria-hidden className="size-3.5 text-amber-300" /> : <Diamond className="size-3" />}
              <span className="tabular-nums">{diamondRewardFor(n)}</span>
            </li>
          );
        })}
      </ol>

      <Button className="h-11 gap-2 rounded-xl" disabled={claimed || busy !== null || !status} onClick={() => void claim()}>
        {busy === 'claim' ? <Loader2 aria-hidden className="size-4 animate-spin motion-reduce:animate-none" /> : <Diamond />}
        {!status ? 'Carregando o cofre…' : claimed ? `Volte amanhã: +${status.nextReward}` : `Resgatar ${status.nextReward} diamantes`}
      </Button>
      <p className="text-center text-[11px] text-violet-200/70">Resgate todo dia: no 7º dia seguido vem um bônus. Pulou um dia, a sequência recomeça.</p>

      <div className="grid grid-cols-3 gap-2" role="group" aria-label="Trocar diamantes por moedas">
        {DIAMOND_PACKS.map((pack) => {
          const bonus = packBonus(pack);
          return (
            <button
              key={pack.diamonds}
              type="button"
              disabled={diamonds < pack.diamonds || busy !== null}
              onClick={() => void exchange(pack.diamonds)}
              className="relative flex min-h-16 flex-col items-center justify-center gap-0.5 rounded-2xl bg-white/5 px-2 py-2 ring-1 ring-white/15 transition enabled:hover:bg-white/10 enabled:active:scale-95 disabled:opacity-40"
              aria-label={`Trocar ${pack.diamonds} diamantes por ${pack.coins} moedas`}
            >
              {bonus > 0 && <span className="absolute -top-2 rounded-full bg-amber-400 px-1.5 text-[10px] font-black text-amber-950">+{bonus}%</span>}
              <Diamonds amount={pack.diamonds} className="text-sm text-cyan-100" />
              <Coins amount={pack.coins} className="text-xs text-amber-200" />
            </button>
          );
        })}
      </div>
    </section>
  );
}

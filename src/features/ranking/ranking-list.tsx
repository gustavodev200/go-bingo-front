'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Coins } from '@/components/stage/coin';
import { rankingResponseSchema, WEEKLY_MIN_MATCHES, WEEKLY_PRIZES, type RankingResponse, type RankingScope } from '@/contracts';
import { TierBadge, tierFor } from '@/features/arena/tier-badge';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';

const MEDALS: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

const SCOPES: Array<{ id: RankingScope; label: string }> = [
  { id: 'all', label: 'Geral' },
  { id: 'week', label: 'Semana' },
];

function fetchPage(cursor: number, scope: RankingScope): Promise<RankingResponse> {
  return apiFetch(`/ranking?cursor=${cursor}&scope=${scope}`, rankingResponseSchema);
}

export function RankingList({ myUserId }: { myUserId: string }) {
  const [scope, setScope] = useState<RankingScope>('all');
  const [pages, setPages] = useState<RankingResponse[]>([]);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    // Trocar de aba recomeça a lista; setState antes do await é intencional.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPages([]);
    setError(false);
    fetchPage(0, scope)
      .then((page) => active && setPages([page]))
      .catch(() => active && setError(true));
    return () => {
      active = false;
    };
  }, [scope]);

  async function loadMore(cursor: number) {
    try {
      const page = await fetchPage(cursor, scope);
      setPages((prev) => [...prev, page]);
    } catch {
      setError(true);
    }
  }

  const last = pages.at(-1);
  const me = pages[0]?.me;
  const week = scope === 'week';
  return (
    <div className="flex flex-col gap-3">
      <div role="tablist" aria-label="Período do ranking" className="grid grid-cols-2 gap-1 rounded-2xl bg-white/5 p-1">
        {SCOPES.map((s) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={scope === s.id}
            onClick={() => setScope(s.id)}
            className={cn('min-h-11 rounded-xl text-sm font-semibold transition-colors', scope === s.id ? 'bg-amber-300 text-amber-950' : 'text-violet-100 hover:bg-white/10')}
          >
            {s.label}
          </button>
        ))}
      </div>
      {week && (
        <p className="glass rounded-2xl px-4 py-3 text-center text-xs text-violet-100">
          Pontos ganhos em todos os jogos de segunda a domingo. Com {WEEKLY_MIN_MATCHES} partidas pontuadas, o top 3 leva{' '}
          {WEEKLY_PRIZES.map((p, i) => (
            <span key={p}>
              {i > 0 && ' · '}
              {MEDALS[i + 1]} <Coins amount={p} className="align-middle text-amber-200" />
            </span>
          ))}
          .
        </p>
      )}
      {error ? (
        <p role="alert" className="glass p-4 text-center">
          Não foi possível carregar o ranking.
        </p>
      ) : !last ? (
        <p aria-busy="true" className="text-muted-foreground text-center text-sm">
          Carregando ranking…
        </p>
      ) : (
        <>
          <p className="glass rounded-2xl px-4 py-3 text-center text-sm font-semibold text-amber-200">
            {me
              ? `Sua posição: ${me.rank}º · ${me.points} pts`
              : week
                ? 'Vença partidas contra jogadores logados para entrar no ranking da semana.'
                : 'Entre com Google e jogue para aparecer no ranking.'}
          </p>
          <ol className="flex flex-col gap-1.5">
            {pages
              .flatMap((p) => p.entries)
              .map((e) => (
                <li
                  key={e.userId}
                  className={cn(
                    'flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5',
                    e.rank <= 3 && 'border-amber-300/30 bg-amber-300/10',
                    e.userId === myUserId && 'border-amber-300 bg-amber-300/20 font-semibold shadow-[0_0_20px_-6px_rgb(251_191_36/0.7)]',
                  )}
                >
                  <span aria-hidden className="w-7 text-center text-xl">
                    {MEDALS[e.rank] ?? '🎱'}
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    {e.rank}º {e.nickname}
                  </span>
                  {!week && <TierBadge points={e.points} className="hidden sm:inline-flex" />}
                  {week && e.matches !== undefined && e.matches < WEEKLY_MIN_MATCHES && (
                    <span className="text-xs text-violet-200/70" title={`Faltam ${WEEKLY_MIN_MATCHES - e.matches} partidas para concorrer ao prêmio`}>
                      {e.matches}/{WEEKLY_MIN_MATCHES}
                    </span>
                  )}
                  <span className="font-display font-semibold text-amber-300">
                    {week ? '+' : ''}
                    {e.points} pts
                  </span>
                </li>
              ))}
          </ol>
          {me && !week && <NextTier points={me.points} />}
          {last.nextCursor !== null && (
            <Button variant="outline" className="h-11 rounded-xl" onClick={() => void loadMore(last.nextCursor!)}>
              Carregar mais
            </Button>
          )}
        </>
      )}
    </div>
  );
}

/** Meta curta: quanto falta para a próxima liga (e o bônus que ela paga). */
function NextTier({ points }: { points: number }) {
  const { tier, next } = tierFor(points);
  if (!next) return <p className="text-center text-xs text-violet-200/70">Você está na liga mais alta: {tier.label}. 👑</p>;
  return (
    <p className="text-center text-xs text-violet-200/70">
      Liga {tier.label} · faltam {next.min - points} pts para {next.label} (+{next.bonus} moedas).
    </p>
  );
}

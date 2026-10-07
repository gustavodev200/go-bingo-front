'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { rankingResponseSchema, type RankingResponse } from '@/contracts';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';

const MEDALS: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

function fetchPage(cursor: number): Promise<RankingResponse> {
  return apiFetch(`/ranking?cursor=${cursor}`, rankingResponseSchema);
}

export function RankingList({ myUserId }: { myUserId: string }) {
  const [pages, setPages] = useState<RankingResponse[]>([]);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    fetchPage(0)
      .then((page) => active && setPages([page]))
      .catch(() => active && setError(true));
    return () => {
      active = false;
    };
  }, []);

  async function loadMore(cursor: number) {
    try {
      const page = await fetchPage(cursor);
      setPages((prev) => [...prev, page]);
    } catch {
      setError(true);
    }
  }

  const last = pages.at(-1);
  const me = pages[0]?.me;
  if (error) return <p role="alert" className="glass p-4 text-center">Não foi possível carregar o ranking.</p>;
  if (!last) return <p aria-busy="true" className="text-muted-foreground text-center text-sm">Carregando ranking…</p>;
  return (
    <div className="flex flex-col gap-3">
      <p className="glass rounded-2xl px-4 py-3 text-center text-sm font-semibold text-amber-200">
        {me ? `Sua posição: ${me.rank}º · ${me.points} pts` : 'Entre com Google e jogue para aparecer no ranking.'}
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
              <span className="font-display font-semibold text-amber-300">{e.points} pts</span>
            </li>
          ))}
      </ol>
      {last.nextCursor !== null && (
        <Button variant="outline" className="h-11 rounded-xl" onClick={() => void loadMore(last.nextCursor!)}>
          Carregar mais
        </Button>
      )}
    </div>
  );
}

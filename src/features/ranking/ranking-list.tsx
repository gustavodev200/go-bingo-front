'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { rankingResponseSchema, type RankingResponse } from '@/contracts';
import { apiFetch } from '@/lib/api';

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
  if (error) return <p role="alert">Não foi possível carregar o ranking.</p>;
  if (!last) return <p aria-busy="true">Carregando ranking…</p>;
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm">{me ? `Sua posição: ${me.rank}º · ${me.points} pts` : 'Entre com Google e jogue para aparecer no ranking.'}</p>
      <ol className="flex flex-col gap-1">
        {pages
          .flatMap((p) => p.entries)
          .map((e) => (
            <li key={e.userId} className={`flex justify-between rounded px-3 py-2 ${e.userId === myUserId ? 'bg-primary/10 font-semibold' : ''}`}>
              <span>
                {e.rank}º {e.nickname}
              </span>
              <span>{e.points} pts</span>
            </li>
          ))}
      </ol>
      {last.nextCursor !== null && (
        <Button variant="outline" className="h-11" onClick={() => void loadMore(last.nextCursor!)}>
          Carregar mais
        </Button>
      )}
    </div>
  );
}

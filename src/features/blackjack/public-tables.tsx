'use client';

import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { BJ_SEATS } from '@/contracts';
import { Avatar } from '@/components/stage/avatar';
import { usePublicBjTables } from './connection';
import { rulesSummary } from './rules-view';
import { Coins } from '@/components/stage/coin';

/** Live list of public blackjack tables still taking players. */
export function PublicTables() {
  const rooms = usePublicBjTables();
  if (rooms === null)
    return (
      <p aria-busy="true" className="text-muted-foreground text-sm">
        Procurando mesas…
      </p>
    );
  if (rooms.length === 0) return <p className="text-muted-foreground rounded-2xl border border-dashed border-white/15 px-4 py-6 text-center text-sm">Nenhuma mesa pública agora. Crie uma!</p>;
  return (
    <ul className="flex flex-col gap-2">
      {rooms.map((room) => (
        <li key={room.code}>
          <Link
            href={`/blackjack/${room.code}`}
            aria-label={`Entrar na mesa de ${room.hostNickname}, ${room.players} de ${BJ_SEATS} jogadores`}
            className="glass group flex min-h-11 items-center gap-3 rounded-2xl px-4 py-3 transition hover:-translate-y-0.5 hover:border-amber-300/50"
          >
            <Avatar id={room.code} character={room.hostCharacter} className="w-9" />
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate font-semibold">Mesa de {room.hostNickname}</span>
              <span className="flex flex-wrap gap-1 text-[11px] font-semibold">
                <span className="rounded-full bg-white/10 px-2">{rulesSummary(room.rules)}</span>
              </span>
            </span>
            {room.stake > 0 && <Coins amount={room.stake} className="rounded-full bg-amber-300/15 px-2 py-0.5 text-xs text-amber-200" />}
            <span className="text-sm font-bold text-amber-200 tabular-nums">
              {room.players}/{BJ_SEATS}
            </span>
            <ChevronRight aria-hidden className="size-5 text-amber-300 transition group-hover:translate-x-0.5" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

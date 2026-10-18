'use client';

import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { DOMINO_SEATS } from '@/contracts';
import { Avatar } from '@/components/stage/avatar';
import { usePublicDominoTables } from './connection';
import { TARGET_LABEL } from './rules-view';

/** Live list of public dominó tables that still have a free seat. */
export function PublicTables() {
  const rooms = usePublicDominoTables();
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
            href={`/domino/${room.code}`}
            aria-label={`Entrar na mesa de ${room.hostNickname}, ${room.players} de ${DOMINO_SEATS} jogadores`}
            className="glass group flex min-h-11 items-center gap-3 rounded-2xl px-4 py-3 transition hover:-translate-y-0.5 hover:border-amber-300/50"
          >
            <Avatar id={room.code} character={room.hostCharacter} className="w-9" />
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate font-semibold">Mesa de {room.hostNickname}</span>
              <span className="flex flex-wrap gap-1 text-[11px] font-semibold">
                <span className="rounded-full bg-white/10 px-2">{TARGET_LABEL[room.rules.target]}</span>
                {room.rules.teams && <span className="rounded-full bg-amber-300/20 px-2 text-amber-100">Duplas</span>}
              </span>
            </span>
            <span className="text-sm font-bold text-amber-200 tabular-nums">
              {room.players}/{DOMINO_SEATS}
            </span>
            <ChevronRight aria-hidden className="size-5 text-amber-300 transition group-hover:translate-x-0.5" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

'use client';

import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { TRUCO_SEATS } from '@/contracts';
import { Avatar } from '@/components/stage/avatar';
import { usePublicTables } from './connection';

/** Live list of public truco tables that still have a free seat. */
export function PublicTables() {
  const rooms = usePublicTables();
  if (rooms === null)
    return (
      <p aria-busy="true" className="text-muted-foreground text-sm">
        Procurando mesas…
      </p>
    );
  if (rooms.length === 0)
    return <p className="text-muted-foreground rounded-2xl border border-dashed border-white/15 px-4 py-6 text-center text-sm">Nenhuma mesa pública agora. Crie uma!</p>;
  return (
    <ul className="flex flex-col gap-2">
      {rooms.map((room) => (
        <li key={room.code}>
          <Link
            href={`/truco/${room.code}`}
            aria-label={`Entrar na mesa de ${room.hostNickname}, ${room.players} de ${TRUCO_SEATS} jogadores`}
            className="glass group flex min-h-11 items-center gap-3 rounded-2xl px-4 py-3 transition hover:-translate-y-0.5 hover:border-emerald-300/50"
          >
            <Avatar id={room.code} character={room.hostCharacter} className="w-9" />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate font-semibold">Mesa de {room.hostNickname}</span>
              <span className="text-muted-foreground text-sm">#{room.code}</span>
            </span>
            <span className="flex items-center gap-1" aria-hidden>
              {Array.from({ length: TRUCO_SEATS }, (_, i) => (
                <span key={i} className={i < room.players ? 'size-2.5 rounded-full bg-emerald-400' : 'size-2.5 rounded-full bg-white/15'} />
              ))}
            </span>
            <span className="text-sm font-bold text-emerald-200 tabular-nums">
              {room.players}/{TRUCO_SEATS}
            </span>
            <ChevronRight aria-hidden className="size-5 text-amber-300 transition group-hover:translate-x-0.5" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

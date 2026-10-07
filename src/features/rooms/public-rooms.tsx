'use client';

import { ChevronRight, Users } from 'lucide-react';
import Link from 'next/link';
import { WIN_PATTERN_LABELS } from '@/contracts';
import { usePublicRooms } from './use-public-rooms';

export function PublicRooms() {
  const rooms = usePublicRooms();
  if (rooms === null) return <p aria-busy="true" className="text-muted-foreground text-sm">Carregando salas…</p>;
  if (rooms.length === 0) {
    return (
      <p className="text-muted-foreground rounded-2xl border border-dashed border-white/15 px-4 py-6 text-center text-sm">
        Nenhuma sala pública agora. Crie uma!
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-2">
      {rooms.map((room) => (
        <li key={room.code}>
          <Link
            href={`/${room.code}`}
            className="glass group flex min-h-11 items-center gap-3 rounded-2xl px-4 py-3 transition hover:-translate-y-0.5 hover:border-amber-300/50"
          >
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate font-semibold">{room.name}</span>
              <span className="text-muted-foreground text-sm">
                {room.playerCount}/{room.maxPlayers} · {WIN_PATTERN_LABELS[room.winPattern]} · #{room.code}
              </span>
            </span>
            <Users aria-hidden className="size-4 text-pink-300" />
            <ChevronRight aria-hidden className="size-5 text-amber-300 transition group-hover:translate-x-0.5" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

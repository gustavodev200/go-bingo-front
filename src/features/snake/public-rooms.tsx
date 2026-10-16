'use client';

import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { SNAKE_MAX_PLAYERS } from '@/contracts';
import { Avatar } from '@/components/stage/avatar';
import { usePublicSnakeRooms } from './connection';

/** Live list of public Snake.io rooms that still have a free place. */
export function PublicRooms() {
  const rooms = usePublicSnakeRooms();
  if (rooms === null)
    return (
      <p aria-busy="true" className="text-muted-foreground text-sm">
        Procurando salas…
      </p>
    );
  if (rooms.length === 0) return <p className="text-muted-foreground rounded-2xl border border-dashed border-white/15 px-4 py-6 text-center text-sm">Nenhuma sala pública agora. Crie uma!</p>;
  return (
    <ul className="flex flex-col gap-2">
      {rooms.map((room) => (
        <li key={room.code}>
          <Link
            href={`/snake/${room.code}`}
            aria-label={`Entrar na sala de ${room.hostNickname}, ${room.players} de ${SNAKE_MAX_PLAYERS} jogadores`}
            className="glass group flex min-h-11 items-center gap-3 rounded-2xl px-4 py-3 transition hover:-translate-y-0.5 hover:border-green-300/50"
          >
            <Avatar id={room.code} character={room.hostCharacter} className="w-9" />
            <span className="min-w-0 flex-1 truncate font-semibold">Sala de {room.hostNickname}</span>
            <span className="text-sm font-bold text-green-300 tabular-nums">
              {room.players}/{SNAKE_MAX_PLAYERS}
            </span>
            <ChevronRight aria-hidden className="size-5 text-green-300 transition group-hover:translate-x-0.5" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

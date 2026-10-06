'use client';

import Link from 'next/link';
import { usePublicRooms } from './use-public-rooms';

export function PublicRooms() {
  const rooms = usePublicRooms();
  if (rooms === null) return <p aria-busy="true">Carregando salas…</p>;
  if (rooms.length === 0) return <p className="text-muted-foreground">Nenhuma sala pública agora. Crie uma!</p>;
  return (
    <ul className="flex flex-col gap-2">
      {rooms.map((room) => (
        <li key={room.code}>
          <Link href={`/${room.code}`} className="flex min-h-11 items-center justify-between rounded-lg border px-4 py-3">
            <span className="font-medium">{room.name}</span>
            <span className="text-muted-foreground text-sm">
              {room.playerCount}/{room.maxPlayers} · #{room.code}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

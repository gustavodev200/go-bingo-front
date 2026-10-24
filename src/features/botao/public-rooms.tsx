'use client';

import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { BOTAO_SEATS } from '@/contracts';
import { Avatar } from '@/components/stage/avatar';
import { Coins } from '@/components/stage/coin';
import { usePublicBotaoRooms } from './connection';

/** Lista ao vivo das salas públicas de futebol de botão com lugar sobrando. */
export function PublicRooms() {
  const rooms = usePublicBotaoRooms();
  if (rooms === null)
    return (
      <p aria-busy="true" className="text-muted-foreground text-sm">
        Procurando salas…
      </p>
    );
  if (rooms.length === 0) return <p className="text-muted-foreground rounded-2xl border border-dashed border-white/15 px-4 py-6 text-center text-sm">Nenhuma sala pública agora. Crie uma!</p>;
  return (
    <ul className="flex flex-col gap-2">
      {rooms.map((room) => {
        const total = room.players[0] + room.players[1];
        return (
          <li key={room.code}>
            <Link
              href={`/botao/${room.code}`}
              aria-label={`Entrar na sala de ${room.hostNickname}, ${room.players[0]} contra ${room.players[1]}, ${total} de ${BOTAO_SEATS} jogadores`}
              className="glass group flex min-h-11 items-center gap-3 rounded-2xl px-4 py-3 transition hover:-translate-y-0.5 hover:border-emerald-300/50"
            >
              <Avatar id={room.code} character={room.hostCharacter} className="w-9" />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate font-semibold">Sala de {room.hostNickname}</span>
                <span className="flex flex-wrap gap-1 text-[11px] font-semibold">
                  <span className="rounded-full bg-white/10 px-2">{room.rules.minutes} min</span>
                  <span className="rounded-full bg-white/10 px-2">{room.rules.goals ? `${room.rules.goals} ${room.rules.goals === 1 ? 'gol' : 'gols'}` : 'sem limite de gols'}</span>
                </span>
              </span>
              {room.stake > 0 && <Coins amount={room.stake} className="rounded-full bg-amber-300/15 px-2 py-0.5 text-xs text-amber-200" />}
              <span className="flex items-center gap-1 text-sm font-black tabular-nums" aria-hidden>
                <span className="text-[#ff8f7a]">{room.players[0]}</span>
                <span className="text-white/50">x</span>
                <span className="text-[#8fb2ff]">{room.players[1]}</span>
              </span>
              <ChevronRight aria-hidden className="size-5 text-emerald-300 transition group-hover:translate-x-0.5" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

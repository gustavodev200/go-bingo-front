'use client';

import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ConnectionBanner } from '@/features/game/connection-banner';
import { ArenaScreen } from './arena-screen';
import { ArenaBus } from './bus';
import { useBomberRoom, type BomberListeners } from './connection';
import { RoomLobby } from './room-lobby';
import { useBomberStore, type BomberExit } from './store';

const EXIT_TITLE: Record<BomberExit['reason'], string> = {
  not_found: 'Sala não encontrada',
  full: 'Sala cheia',
  in_progress: 'Partida em andamento',
  error: 'Não deu para entrar',
  left: 'Você saiu',
};

function ExitScreen({ exit }: { exit: BomberExit }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-4 text-center" role="alert">
      <span aria-hidden className="text-6xl">
        💣
      </span>
      <h1 className="font-display text-marquee text-3xl font-bold">{EXIT_TITLE[exit.reason]}</h1>
      <p className="text-violet-100">{exit.message}</p>
      <Button asChild size="lg" className="h-12 rounded-xl">
        <Link href="/bomber">
          <ChevronLeft aria-hidden /> Voltar ao lobby do Bomberman
        </Link>
      </Button>
    </main>
  );
}

/** One Bomberman room: joins it over Socket.IO and shows the character select or the arena. */
export function BomberRoomScreen({ code }: { code: string }) {
  const router = useRouter();
  const connection = useBomberStore((s) => s.connection);
  const state = useBomberStore((s) => s.state);
  const mySeat = useBomberStore((s) => s.mySeat);
  const myUserId = useBomberStore((s) => s.myUserId);
  const exit = useBomberStore((s) => s.exit);
  const [bus] = useState(() => new ArenaBus());

  const listeners = useMemo<BomberListeners>(
    () => ({
      onFrame: (frame) => bus.pushFrame(frame),
      onAnnouncement: (msg) => bus.announce(msg),
    }),
    [bus],
  );
  const actions = useBomberRoom(code, listeners);

  useEffect(() => {
    if (mySeat !== null) bus.setSeat(mySeat);
  }, [bus, mySeat]);

  useEffect(() => {
    if (exit?.reason === 'left') router.replace('/bomber');
  }, [exit, router]);

  if (exit && exit.reason !== 'left') return <ExitScreen exit={exit} />;
  if (state && mySeat === null && myUserId && !exit) return <ExitScreen exit={{ reason: 'error', message: 'Você não está mais nesta sala. Entre de novo pelo código.' }} />;
  if (!state || mySeat === null || exit)
    return (
      <div className="flex min-h-dvh items-center justify-center" aria-busy="true" role="status">
        {connection === 'reconnecting' ? 'Reconectando à sala…' : 'Entrando na sala…'}
      </div>
    );

  return (
    <>
      <ConnectionBanner status={connection} />
      {state.phase === 'LOBBY' ? <RoomLobby state={state} mySeat={mySeat} actions={actions} /> : <ArenaScreen state={state} mySeat={mySeat} actions={actions} bus={bus} />}
    </>
  );
}

'use client';

import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ConnectionBanner } from '@/features/game/connection-banner';
import { InfBus } from './bus';
import { useInfRoom, type InfListeners } from './connection';
import { GameScreen } from './game-screen';
import { RoomLobby } from './room-lobby';
import { useInfStore, type InfExit } from './store';

const EXIT_TITLE: Record<InfExit['reason'], string> = {
  not_found: 'Sala não encontrada',
  full: 'Sala cheia',
  in_progress: 'Partida em andamento',
  error: 'Não deu para entrar',
  left: 'Você saiu',
};

function ExitScreen({ exit }: { exit: InfExit }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-4 text-center" role="alert">
      <span aria-hidden className="text-6xl">
        🫧
      </span>
      <h1 className="font-display text-marquee text-3xl font-bold">{EXIT_TITLE[exit.reason]}</h1>
      <p className="text-violet-100">{exit.message}</p>
      <Button asChild size="lg" className="h-12 rounded-xl">
        <Link href="/infiltrado">
          <ChevronLeft aria-hidden /> Voltar ao lobby do Infiltrado
        </Link>
      </Button>
    </main>
  );
}

/** One Infiltrado room: joins it over Socket.IO and shows the lobby or the station. */
export function InfRoomScreen({ code }: { code: string }) {
  const router = useRouter();
  const connection = useInfStore((s) => s.connection);
  const state = useInfStore((s) => s.state);
  const mySeat = useInfStore((s) => s.mySeat);
  const myUserId = useInfStore((s) => s.myUserId);
  const exit = useInfStore((s) => s.exit);
  const [bus] = useState(() => new InfBus());

  const listeners = useMemo<InfListeners>(
    () => ({
      onFrame: (frame) => bus.pushFrame(frame),
      onAnnouncement: (msg) => {
        if (msg.event === 'inf:match_started') {
          bus.clear();
          useInfStore.getState().clearChat();
        }
        bus.announce(msg);
      },
      onChat: (message) => useInfStore.getState().addChat(message, false),
    }),
    [bus],
  );
  const actions = useInfRoom(code, listeners);

  useEffect(() => {
    if (exit?.reason === 'left') router.replace('/infiltrado');
  }, [exit, router]);

  if (exit && exit.reason !== 'left') return <ExitScreen exit={exit} />;
  if (state && mySeat === null && myUserId && !exit) return <ExitScreen exit={{ reason: 'error', message: 'Você não está mais nesta sala. Entre de novo pelo código.' }} />;
  if (!state || mySeat === null || exit)
    return (
      <div className="flex min-h-dvh items-center justify-center" aria-busy="true" role="status">
        {connection === 'reconnecting' ? 'Reconectando à estação…' : 'Entrando na estação…'}
      </div>
    );

  return (
    <>
      <ConnectionBanner status={connection} />
      {state.phase === 'LOBBY' ? <RoomLobby state={state} mySeat={mySeat} actions={actions} /> : <GameScreen state={state} mySeat={mySeat} actions={actions} bus={bus} />}
    </>
  );
}

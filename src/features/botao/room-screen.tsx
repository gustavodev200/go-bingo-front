'use client';

import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ConnectionBanner } from '@/features/game/connection-banner';
import { MatchScreen } from './match-screen';
import { FieldBus } from './bus';
import { useBotaoRoom, type BotaoListeners } from './connection';
import { RoomLobby } from './room-lobby';
import { useBotaoStore, type BotaoExit } from './store';

const EXIT_TITLE: Record<BotaoExit['reason'], string> = {
  not_found: 'Sala não encontrada',
  full: 'Sala cheia',
  in_progress: 'Partida em andamento',
  error: 'Não deu para entrar',
  left: 'Você saiu',
};

function ExitScreen({ exit }: { exit: BotaoExit }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-4 text-center" role="alert">
      <span aria-hidden className="text-6xl">
        ⚽
      </span>
      <h1 className="font-display text-marquee text-3xl font-bold">{EXIT_TITLE[exit.reason]}</h1>
      <p className="text-violet-100">{exit.message}</p>
      <Button asChild size="lg" className="h-12 rounded-xl">
        <Link href="/botao">
          <ChevronLeft aria-hidden /> Voltar ao lobby do Futebol de Botão
        </Link>
      </Button>
    </main>
  );
}

/** Uma sala de futebol de botão: entra via Socket.IO e mostra o vestiário (lobby) ou o campo. */
export function BotaoRoomScreen({ code }: { code: string }) {
  const router = useRouter();
  const connection = useBotaoStore((s) => s.connection);
  const state = useBotaoStore((s) => s.state);
  const mySeat = useBotaoStore((s) => s.mySeat);
  const myUserId = useBotaoStore((s) => s.myUserId);
  const exit = useBotaoStore((s) => s.exit);
  const [bus] = useState(() => new FieldBus());

  const listeners = useMemo<BotaoListeners>(
    () => ({
      onFrame: (frame) => bus.pushFrame(frame),
      onAnnouncement: (msg) => bus.announce(msg),
    }),
    [bus],
  );
  const actions = useBotaoRoom(code, listeners);

  useEffect(() => {
    if (mySeat !== null) bus.setSeat(mySeat);
  }, [bus, mySeat]);

  useEffect(() => {
    if (exit?.reason === 'left') router.replace('/botao');
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
      {state.phase === 'LOBBY' ? <RoomLobby state={state} mySeat={mySeat} actions={actions} /> : <MatchScreen state={state} mySeat={mySeat} actions={actions} bus={bus} />}
    </>
  );
}

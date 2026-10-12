'use client';

import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { ConnectionBanner } from '@/features/game/connection-banner';
import { sharedNarrator } from '@/features/game/sound/narration';
import { sharedSfxPlayer } from '@/features/game/sound/sfx-player';
import { playReaction, useTrucoAudioPrefs } from './audio';
import { useTrucoRoom, type TrucoListeners } from './connection';
import { reactionFor } from './reactions';
import { RoomLobby } from './room-lobby';
import { useEffectsExpiry } from './shout-overlay';
import { useConventions } from './signals-settings';
import { useTrucoStore, type TrucoExit } from './store';
import { TableView } from './table-view';

const EXIT_TITLE: Record<TrucoExit['reason'], string> = {
  not_found: 'Mesa não encontrada',
  full: 'Mesa cheia',
  in_progress: 'Partida em andamento',
  error: 'Não deu para entrar',
  left: 'Você saiu',
};

function ExitScreen({ exit }: { exit: TrucoExit }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-4 text-center" role="alert">
      <span aria-hidden className="text-6xl">
        🃏
      </span>
      <h1 className="font-display text-marquee text-3xl font-bold">{EXIT_TITLE[exit.reason]}</h1>
      <p className="text-violet-100">{exit.message}</p>
      <Button asChild size="lg" className="h-12 rounded-xl">
        <Link href="/truco">
          <ChevronLeft aria-hidden /> Voltar ao lobby do truco
        </Link>
      </Button>
    </main>
  );
}

/** One truco table: joins it over Socket.IO, shows the waiting room or the table, and plays the effects. */
export function TrucoRoomScreen({ code }: { code: string }) {
  const router = useRouter();
  const connection = useTrucoStore((s) => s.connection);
  const state = useTrucoStore((s) => s.state);
  const mySeat = useTrucoStore((s) => s.mySeat);
  const hand = useTrucoStore((s) => s.hand);
  const myUserId = useTrucoStore((s) => s.myUserId);
  const exit = useTrucoStore((s) => s.exit);
  const audio = useTrucoAudioPrefs();
  const [conventions, setConventions] = useConventions();
  const prefs = useRef({ voice: audio.voice, sfx: audio.sfx });
  useEffect(() => {
    prefs.current = { voice: audio.voice, sfx: audio.sfx };
  }, [audio.voice, audio.sfx]);

  const listeners = useMemo<TrucoListeners>(() => {
    const deps = () => ({ sfx: sharedSfxPlayer(), narrator: sharedNarrator() });
    const { addEffect } = useTrucoStore.getState();
    return {
      onAnnouncement: (msg) => {
        const seat = useTrucoStore.getState().mySeat;
        if (seat === null) return;
        const reaction = reactionFor(msg, seat);
        if (reaction.shout) addEffect({ kind: 'shout', ...reaction.shout });
        if (reaction.banner) addEffect({ kind: 'banner', ...reaction.banner });
        playReaction(reaction, prefs.current, deps());
      },
      // Only the partner ever receives this event: show which gesture it was.
      onSignal: ({ fromSeat, gesture }) => {
        addEffect({ kind: 'gesture', seat: fromSeat, gesture });
        playReaction({ sfx: 'signal' }, prefs.current, deps());
      },
      // Opponents only see that somebody made a face.
      onGesture: ({ seat }) => addEffect({ kind: 'gesture', seat, gesture: null }),
      onError: () => playReaction({ sfx: 'error' }, prefs.current, deps()),
    };
  }, []);

  const actions = useTrucoRoom(code, listeners);
  useEffectsExpiry();

  // Browsers only allow audio after a user gesture.
  useEffect(() => {
    const unlock = () => sharedSfxPlayer().unlock();
    window.addEventListener('pointerdown', unlock, { once: true });
    return () => window.removeEventListener('pointerdown', unlock);
  }, []);

  useEffect(() => {
    if (exit?.reason === 'left') router.replace('/truco');
  }, [exit, router]);

  if (exit && exit.reason !== 'left') return <ExitScreen exit={exit} />;
  // Seated before but gone from the latest state (seat released while away).
  if (state && mySeat === null && myUserId && !exit) return <ExitScreen exit={{ reason: 'error', message: 'Você não está mais nesta mesa. Entre de novo pelo código.' }} />;
  if (!state || mySeat === null || exit)
    return (
      <div className="flex min-h-dvh items-center justify-center" aria-busy="true" role="status">
        {connection === 'reconnecting' ? 'Reconectando à mesa…' : 'Entrando na mesa…'}
      </div>
    );

  return (
    <>
      <ConnectionBanner status={connection} />
      {state.phase === 'LOBBY' ? (
        <RoomLobby state={state} mySeat={mySeat} actions={actions} conventions={conventions} setConventions={setConventions} />
      ) : (
        <TableView
          state={state}
          mySeat={mySeat}
          hand={hand}
          actions={actions}
          conventions={conventions}
          audio={audio}
          onSignalSent={(gesture) => useTrucoStore.getState().addEffect({ kind: 'gesture', seat: mySeat, gesture })}
        />
      )}
    </>
  );
}

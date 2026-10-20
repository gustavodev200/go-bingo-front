'use client';

import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef } from 'react';
import { damasColorOf } from '@/contracts';
import { Button } from '@/components/ui/button';
import { ConnectionBanner } from '@/features/game/connection-banner';
import { sharedNarrator } from '@/features/game/sound/narration';
import { sharedSfxPlayer } from '@/features/game/sound/sfx-player';
import { VoiceChat } from '@/features/voice/voice-chat';
import { playReaction, useDamasAudioPrefs } from './audio';
import { useDamasRoom, type DamasListeners } from './connection';
import { reactionFor } from './reactions';
import { RoomLobby } from './room-lobby';
import { useEffectsExpiry } from './shout-overlay';
import { useDamasStore, type DamasExit } from './store';
import { TableView } from './table-view';

const EXIT_TITLE: Record<DamasExit['reason'], string> = {
  not_found: 'Mesa não encontrada',
  full: 'Mesa cheia',
  in_progress: 'Partida em andamento',
  error: 'Não deu para entrar',
  left: 'Você saiu',
};

function ExitScreen({ exit }: { exit: DamasExit }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-4 text-center" role="alert">
      <span aria-hidden className="text-6xl">
        ⛀
      </span>
      <h1 className="font-display text-marquee text-3xl font-bold">{EXIT_TITLE[exit.reason]}</h1>
      <p className="text-violet-100">{exit.message}</p>
      <Button asChild size="lg" className="h-12 rounded-xl">
        <Link href="/damas">
          <ChevronLeft aria-hidden /> Voltar ao lobby das damas
        </Link>
      </Button>
    </main>
  );
}

/** One damas table: joins it over Socket.IO, shows the waiting room or the table, and plays the effects. */
export function DamasRoomScreen({ code }: { code: string }) {
  const router = useRouter();
  const connection = useDamasStore((s) => s.connection);
  const state = useDamasStore((s) => s.state);
  const mySeat = useDamasStore((s) => s.mySeat);
  const myUserId = useDamasStore((s) => s.myUserId);
  const exit = useDamasStore((s) => s.exit);
  const audio = useDamasAudioPrefs();
  const prefs = useRef({ voice: audio.voice, sfx: audio.sfx });
  useEffect(() => {
    prefs.current = { voice: audio.voice, sfx: audio.sfx };
  }, [audio.voice, audio.sfx]);

  const listeners = useMemo<DamasListeners>(() => {
    const deps = () => ({ sfx: sharedSfxPlayer(), narrator: sharedNarrator() });
    const { addEffect } = useDamasStore.getState();
    return {
      onAnnouncement: (msg) => {
        const { mySeat: seat, state: current } = useDamasStore.getState();
        if (seat === null) return;
        const reaction = reactionFor(msg, seat, (s) => current?.seats[s]?.nickname ?? 'Alguém');
        if (reaction.shout) addEffect({ kind: 'shout', ...reaction.shout });
        if (reaction.banner) addEffect({ kind: 'banner', ...reaction.banner });
        playReaction(reaction, prefs.current, deps());
      },
      onEmote: ({ seat, emote }) => addEffect({ kind: 'emote', seat, emote }),
      onError: () => playReaction({ sfx: 'error' }, prefs.current, deps()),
    };
  }, []);

  const actions = useDamasRoom(code, listeners);
  useEffectsExpiry();

  // A short chime when the turn comes to me.
  const myTurn = state?.phase === 'PLAYING' && !!state.game && mySeat !== null && state.game.turn === damasColorOf(state, mySeat);
  useEffect(() => {
    if (myTurn) playReaction({ sfx: 'domino-turn' }, { voice: false, sfx: prefs.current.sfx }, { sfx: sharedSfxPlayer(), narrator: sharedNarrator() });
  }, [myTurn]);

  // Browsers only allow audio after a user gesture.
  useEffect(() => {
    const unlock = () => sharedSfxPlayer().unlock();
    window.addEventListener('pointerdown', unlock, { once: true });
    return () => window.removeEventListener('pointerdown', unlock);
  }, []);

  useEffect(() => {
    if (exit?.reason === 'left') router.replace('/damas');
  }, [exit, router]);

  if (exit && exit.reason !== 'left') return <ExitScreen exit={exit} />;
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
      <VoiceChat game="damas" code={state.code} />
      {state.phase === 'LOBBY' ? <RoomLobby state={state} mySeat={mySeat} actions={actions} /> : <TableView state={state} mySeat={mySeat} actions={actions} audio={audio} />}
    </>
  );
}

'use client';

import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { ConnectionBanner } from '@/features/game/connection-banner';
import { sharedNarrator } from '@/features/game/sound/narration';
import { sharedSfxPlayer } from '@/features/game/sound/sfx-player';
import { VoiceChat } from '@/features/voice/voice-chat';
import { playReaction, useBjAudioPrefs } from './audio';
import { useBjRoom, type BjListeners } from './connection';
import { reactionFor } from './reactions';
import { RoomLobby } from './room-lobby';
import { useEffectsExpiry } from './shout-overlay';
import { useBjStore, type BjExit } from './store';
import { TableView } from './table-view';

const EXIT_TITLE: Record<BjExit['reason'], string> = {
  not_found: 'Mesa não encontrada',
  full: 'Mesa cheia',
  in_progress: 'Partida em andamento',
  error: 'Não deu para entrar',
  left: 'Você saiu',
};

function ExitScreen({ exit }: { exit: BjExit }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-4 text-center" role="alert">
      <span aria-hidden className="text-6xl">
        🂡
      </span>
      <h1 className="font-display text-marquee text-3xl font-bold">{EXIT_TITLE[exit.reason]}</h1>
      <p className="text-violet-100">{exit.message}</p>
      <Button asChild size="lg" className="h-12 rounded-xl">
        <Link href="/blackjack">
          <ChevronLeft aria-hidden /> Voltar ao lobby do blackjack
        </Link>
      </Button>
    </main>
  );
}

/** One blackjack table: joins it over Socket.IO, shows the waiting room or the table, and plays the effects. */
export function BjRoomScreen({ code }: { code: string }) {
  const router = useRouter();
  const connection = useBjStore((s) => s.connection);
  const state = useBjStore((s) => s.state);
  const mySeat = useBjStore((s) => s.mySeat);
  const myUserId = useBjStore((s) => s.myUserId);
  const exit = useBjStore((s) => s.exit);
  const audio = useBjAudioPrefs();
  const prefs = useRef({ voice: audio.voice, sfx: audio.sfx });
  useEffect(() => {
    prefs.current = { voice: audio.voice, sfx: audio.sfx };
  }, [audio.voice, audio.sfx]);

  const listeners = useMemo<BjListeners>(() => {
    const deps = () => ({ sfx: sharedSfxPlayer(), narrator: sharedNarrator() });
    const { addEffect } = useBjStore.getState();
    return {
      onAnnouncement: (msg) => {
        const { mySeat: seat, state: current } = useBjStore.getState();
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

  const actions = useBjRoom(code, listeners);
  useEffectsExpiry();

  // A short chime when a decision comes to me (my turn, or a new hand of mine after a split).
  const myTurn = state?.phase === 'PLAYING' && !!state.game && mySeat !== null && state.game.turn?.seat === mySeat;
  const turnKey = myTurn ? `${state.game!.round}-${state.game!.turn!.hand}` : null;
  useEffect(() => {
    if (turnKey) playReaction({ sfx: 'domino-turn' }, { voice: false, sfx: prefs.current.sfx }, { sfx: sharedSfxPlayer(), narrator: sharedNarrator() });
  }, [turnKey]);

  // Browsers only allow audio after a user gesture.
  useEffect(() => {
    const unlock = () => sharedSfxPlayer().unlock();
    window.addEventListener('pointerdown', unlock, { once: true });
    return () => window.removeEventListener('pointerdown', unlock);
  }, []);

  useEffect(() => {
    if (exit?.reason === 'left') router.replace('/blackjack');
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
      <VoiceChat game="blackjack" code={state.code} />
      {state.phase === 'LOBBY' ? <RoomLobby state={state} mySeat={mySeat} actions={actions} /> : <TableView state={state} mySeat={mySeat} actions={actions} audio={audio} />}
    </>
  );
}

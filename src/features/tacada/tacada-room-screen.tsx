'use client';

import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { TacadaGroup } from '@/contracts';
import { Button } from '@/components/ui/button';
import { ConnectionBanner } from '@/features/game/connection-banner';
import { sharedNarrator } from '@/features/game/sound/narration';
import { sharedSfxPlayer } from '@/features/game/sound/sfx-player';
import { VoiceChat } from '@/features/voice/voice-chat';
import { playReaction, useTacadaAudioPrefs } from './audio';
import { useTacadaRoom, type TacadaListeners } from './connection';
import { reactionFor, type Announced } from './reactions';
import { RoomLobby } from './room-lobby';
import { useEffectsExpiry } from './shout-overlay';
import { useTacadaStore, type TacadaExit } from './store';
import { TableView } from './table-view';

const EXIT_TITLE: Record<TacadaExit['reason'], string> = {
  not_found: 'Mesa não encontrada',
  full: 'Mesa cheia',
  in_progress: 'Partida em andamento',
  error: 'Não deu para entrar',
  left: 'Você saiu',
};

function ExitScreen({ exit }: { exit: TacadaExit }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-4 text-center" role="alert">
      <span aria-hidden className="text-6xl">
        🎱
      </span>
      <h1 className="font-display text-marquee text-3xl font-bold">{EXIT_TITLE[exit.reason]}</h1>
      <p className="text-violet-100">{exit.message}</p>
      <Button asChild size="lg" className="h-12 rounded-xl">
        <Link href="/tacada">
          <ChevronLeft aria-hidden /> Voltar ao lobby da Tacada
        </Link>
      </Button>
    </main>
  );
}

/** One Tacada table: joins it over Socket.IO, shows the waiting room or the table, and plays the effects. */
export function TacadaRoomScreen({ code }: { code: string }) {
  const router = useRouter();
  const connection = useTacadaStore((s) => s.connection);
  const state = useTacadaStore((s) => s.state);
  const mySeat = useTacadaStore((s) => s.mySeat);
  const myUserId = useTacadaStore((s) => s.myUserId);
  const exit = useTacadaStore((s) => s.exit);
  const audio = useTacadaAudioPrefs();
  const prefs = useRef({ voice: audio.voice, sfx: audio.sfx });
  useEffect(() => {
    prefs.current = { voice: audio.voice, sfx: audio.sfx };
  }, [audio.voice, audio.sfx]);

  // Reactions wait while a shot is rolling: the banner says what happened once the balls stop.
  const pending = useRef<{ msg: Announced; groupsBefore: (TacadaGroup | null)[] }[]>([]);
  const play = useCallback((msg: Announced, groupsBefore: (TacadaGroup | null)[]) => {
    const { mySeat: seat, state: current, addEffect } = useTacadaStore.getState();
    if (seat === null) return;
    const reaction = reactionFor(msg, {
      mySeat: seat,
      nameOf: (s) => current?.seats[s]?.nickname ?? 'Alguém',
      groups: current?.game?.groups ?? [null, null],
      groupsBefore,
    });
    if (reaction.shout) addEffect({ kind: 'shout', ...reaction.shout });
    if (reaction.banner) addEffect({ kind: 'banner', ...reaction.banner });
    playReaction(reaction, prefs.current, { sfx: sharedSfxPlayer(), narrator: sharedNarrator() });
  }, []);

  const listeners = useMemo<TacadaListeners>(() => {
    const deps = () => ({ sfx: sharedSfxPlayer(), narrator: sharedNarrator() });
    const { addEffect } = useTacadaStore.getState();
    return {
      onAnnouncement: (msg) => {
        const { animating, state: current } = useTacadaStore.getState();
        const groupsBefore = current?.game?.groups ?? [null, null];
        if (animating) pending.current.push({ msg, groupsBefore });
        else play(msg, groupsBefore);
      },
      onEmote: ({ seat, emote }) => addEffect({ kind: 'emote', seat, emote }),
      onError: () => playReaction({ sfx: 'error' }, prefs.current, deps()),
    };
  }, [play]);

  const animating = useTacadaStore((s) => s.animating);
  useEffect(() => {
    if (animating) return;
    const queued = pending.current;
    pending.current = [];
    queued.forEach((p) => play(p.msg, p.groupsBefore));
  }, [animating, play]);

  const actions = useTacadaRoom(code, listeners);
  useEffectsExpiry();

  // A short chime when the turn comes to me.
  const myTurn = state?.phase === 'PLAYING' && !!state.game && mySeat !== null && state.game.turn === mySeat && !animating;
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
    if (exit?.reason === 'left') router.replace('/tacada');
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
      <VoiceChat game="tacada" code={state.code} />
      {state.phase === 'LOBBY' ? <RoomLobby state={state} mySeat={mySeat} actions={actions} /> : <TableView state={state} mySeat={mySeat} actions={actions} audio={audio} />}
    </>
  );
}

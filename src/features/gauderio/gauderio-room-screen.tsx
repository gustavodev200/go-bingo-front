'use client';

import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { ConnectionBanner } from '@/features/game/connection-banner';
import { sharedNarrator } from '@/features/game/sound/narration';
import { sharedSfxPlayer } from '@/features/game/sound/sfx-player';
import { usePersistedFlag } from '@/features/game/sound/use-persisted-flag';
import { playReaction } from '@/features/truco/audio';
import { VoiceChat } from '@/features/voice/voice-chat';
import { useGaudRoom, type GaudListeners } from './connection';
import { reactionFor } from './reactions';
import { RoomLobby } from './room-lobby';
import { useGaudStore, type GaudExit } from './store';
import { useEffectsExpiry } from './table-parts';
import { TableView } from './table-view';

const EXIT_TITLE: Record<GaudExit['reason'], string> = {
  not_found: 'Mesa não encontrada',
  full: 'Mesa cheia',
  in_progress: 'Partida em andamento',
  error: 'Não deu para entrar',
  left: 'Você saiu',
};

function ExitScreen({ exit }: { exit: GaudExit }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-4 text-center" role="alert">
      <span aria-hidden className="text-6xl">
        🧉
      </span>
      <h1 className="font-display text-marquee text-3xl font-bold">{EXIT_TITLE[exit.reason]}</h1>
      <p className="text-violet-100">{exit.message}</p>
      <Button asChild size="lg" className="h-12 rounded-xl">
        <Link href="/gauderio">
          <ChevronLeft aria-hidden /> Voltar ao lobby do Truco Gaudério
        </Link>
      </Button>
    </main>
  );
}

/** Voz e efeitos ligados/desligados separadamente, lembrados no aparelho. */
function useAudioPrefs() {
  const [voice, setVoice] = usePersistedFlag('gauderio:voice', true);
  const [sfx, setSfx] = usePersistedFlag('gauderio:sfx', true);
  return { voice, setVoice, sfx, setSfx };
}

/** Uma mesa: entra pelo Socket.IO, mostra a sala de espera ou a mesa, e toca os efeitos. */
export function GauderioRoomScreen({ code }: { code: string }) {
  const router = useRouter();
  const connection = useGaudStore((s) => s.connection);
  const state = useGaudStore((s) => s.state);
  const mySeat = useGaudStore((s) => s.mySeat);
  const hand = useGaudStore((s) => s.hand);
  const myUserId = useGaudStore((s) => s.myUserId);
  const exit = useGaudStore((s) => s.exit);
  const audio = useAudioPrefs();
  const prefs = useRef({ voice: audio.voice, sfx: audio.sfx });
  useEffect(() => {
    prefs.current = { voice: audio.voice, sfx: audio.sfx };
  }, [audio.voice, audio.sfx]);

  const listeners = useMemo<GaudListeners>(() => {
    const deps = () => ({ sfx: sharedSfxPlayer(), narrator: sharedNarrator() });
    const { addEffect } = useGaudStore.getState();
    return {
      onAnnouncement: (msg) => {
        const seat = useGaudStore.getState().mySeat;
        if (seat === null) return;
        const reaction = reactionFor(msg, seat);
        if (reaction.shout) addEffect({ kind: 'shout', ...reaction.shout });
        if (reaction.banner) addEffect({ kind: 'banner', ...reaction.banner });
        if (reaction.side) addEffect({ kind: 'side', result: reaction.side });
        playReaction(reaction, prefs.current, deps());
      },
      onChat: (message) => useGaudStore.getState().addChat(message),
      onError: () => playReaction({ sfx: 'error' }, prefs.current, deps()),
    };
  }, []);

  const actions = useGaudRoom(code, listeners);
  useEffectsExpiry();

  // O navegador só libera áudio depois de um gesto do usuário.
  useEffect(() => {
    const unlock = () => sharedSfxPlayer().unlock();
    window.addEventListener('pointerdown', unlock, { once: true });
    return () => window.removeEventListener('pointerdown', unlock);
  }, []);

  useEffect(() => {
    if (exit?.reason === 'left') router.replace('/gauderio');
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
      <VoiceChat game="gauderio" code={state.code} />
      {state.phase === 'LOBBY' ? <RoomLobby state={state} mySeat={mySeat} actions={actions} /> : <TableView state={state} mySeat={mySeat} hand={hand} actions={actions} audio={audio} />}
    </>
  );
}

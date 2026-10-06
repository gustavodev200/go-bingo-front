'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useProfile } from '@/features/profile/profile-context';
import { useWakeLock } from '@/features/pwa/use-wake-lock';
import { ConnectionBanner } from './connection-banner';
import { GameView } from './game-view';
import { LobbyView } from './lobby-view';
import { newlyOneAway } from './one-away';
import { ResultDialog } from './result-dialog';
import { SceneControls } from './scene-controls';
import { LobbyStageLazy } from './scene3d/lobby-stage-lazy';
import { useGameStore } from './store';
import { useCelebrationDelay } from './use-celebration-delay';
import { useGameConnection } from './use-game-connection';
import { useSceneMode } from './use-scene-mode';

const EXIT_MESSAGES = {
  kicked: 'O host removeu você da sala.',
  host_cancelled: 'A sala foi encerrada pelo host.',
  empty: 'A sala foi encerrada.',
  not_found: 'Sala não encontrada.',
  error: 'Não foi possível entrar na sala.',
} as const;

export function RoomScreen({ code }: { code: string }) {
  const { profile } = useProfile();
  const router = useRouter();
  const reset = useGameStore((s) => s.reset);
  useEffect(() => reset(profile.id), [reset, profile.id]);

  const actions = useGameConnection(code);
  const snapshot = useGameStore((s) => s.snapshot);
  const connection = useGameStore((s) => s.connection);
  const exit = useGameStore((s) => s.exit);
  const showResult = useGameStore((s) => s.winner !== null || s.endedWithoutWinner);
  useWakeLock(snapshot?.status === 'IN_GAME');
  const scene = useSceneMode();
  const inGame = snapshot?.status === 'IN_GAME' || showResult;
  const showGame = useCelebrationDelay(inGame, scene.mode === '3d');
  useEffect(() => {
    if (scene.reason === 'context-lost') toast('Modo 2D ativado para economizar o aparelho');
  }, [scene.reason]);

  // "Fulano está por 1!"
  const prevRemaining = useRef<Record<string, number>>({});
  const remaining = snapshot?.game?.remaining;
  useEffect(() => {
    if (!remaining || !snapshot) return;
    for (const userId of newlyOneAway(prevRemaining.current, remaining)) {
      const nick = snapshot.members.find((m) => m.userId === userId)?.nickname;
      if (nick) toast(userId === profile.id ? 'Você está por 1!' : `${nick} está por 1!`);
    }
    prevRemaining.current = remaining;
  }, [remaining, snapshot, profile.id]);

  async function leave() {
    await actions.leave();
    router.push('/');
  }

  if (exit) {
    return (
      <main className="mx-auto flex max-w-sm flex-col gap-4 px-4 py-10" role="alert">
        <p>{exit.message ?? EXIT_MESSAGES[exit.reason]}</p>
        <Button asChild className="h-11">
          <Link href="/">Voltar ao início</Link>
        </Button>
      </main>
    );
  }
  if (!snapshot) return <div className="flex h-dvh items-center justify-center" aria-busy="true">Entrando na sala…</div>;

  return (
    <>
      <ConnectionBanner status={connection} />
      {showGame ? (
        <GameView actions={actions} />
      ) : (
        <>
          {scene.mode === '3d' && (
            <div className="h-[40dvh] w-full landscape:h-[55dvh]">
              <LobbyStageLazy
                key={scene.stageKey}
                roomName={snapshot.name}
                code={snapshot.code}
                celebrating={inGame}
                qualityOverride={scene.quality}
                onContextLost={scene.reportContextLoss}
              />
            </div>
          )}
          <SceneControls mode={scene.mode} quality={scene.quality} onModeChange={scene.setPreferred} onQualityChange={scene.setQuality} />
          <LobbyView actions={actions} onLeave={() => void leave()} />
        </>
      )}
      {showResult && <ResultDialog onReplay={() => void actions.replay()} onLeave={() => void leave()} />}
    </>
  );
}

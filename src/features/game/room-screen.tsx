'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { MiniGlobe } from '@/components/stage/stage';
import { Button } from '@/components/ui/button';
import { useProfile } from '@/features/profile/profile-context';
import { createSessionTelemetry, reportSessionSummary } from '@/lib/telemetry';
import { useWakeLock } from '@/features/pwa/use-wake-lock';
import { ConnectionBanner } from './connection-banner';
import { GameView } from './game-view';
import { LobbyView } from './lobby-view';
import { newlyOneAway } from './one-away';
import { ResultDialog } from './result-dialog';
import { SceneControls } from './scene-controls';
import { StageErrorBoundary } from './stage-error-boundary';
import { GameStageLazy } from './scene3d/game-stage-lazy';
import { LobbyStageLazy } from './scene3d/lobby-stage-lazy';
import { useGameSounds } from './sound/use-game-sounds';
import { useMuted } from './sound/use-muted';
import { useGameStore } from './store';
import { useCelebrationDelay } from './use-celebration-delay';
import { useGameConnection } from './use-game-connection';
import { useSceneMode } from './use-scene-mode';

/** No 3D, o diálogo de resultado espera a cena de vitória. */
export const RESULT_DELAY_MS = 2500;

const EXIT_MESSAGES = {
  kicked: 'O host removeu você da sala.',
  host_cancelled: 'A sala foi encerrada pelo host.',
  empty: 'A sala foi encerrada.',
  not_found: 'Sala não encontrada.',
  error: 'Não foi possível entrar na sala.',
} as const;

export function RoomScreen({ code }: { code: string }) {
  const { profile, refresh } = useProfile();
  const router = useRouter();
  const reset = useGameStore((s) => s.reset);
  useEffect(() => reset(profile.id), [reset, profile.id]);

  // Uma instância por montagem da sala; o resumo sai uma vez ao sair/fechar a aba.
  const [telemetry] = useState(() => createSessionTelemetry(reportSessionSummary));
  useEffect(() => {
    window.addEventListener('pagehide', telemetry.flush);
    return () => {
      window.removeEventListener('pagehide', telemetry.flush);
      telemetry.flush();
    };
  }, [telemetry]);

  const actions = useGameConnection(code, telemetry.addDrawLatencyMs);
  const snapshot = useGameStore((s) => s.snapshot);
  const connection = useGameStore((s) => s.connection);
  const exit = useGameStore((s) => s.exit);
  const showResult = useGameStore((s) => s.winner !== null || s.endedWithoutWinner);
  useWakeLock(snapshot?.status === 'IN_GAME');
  const scene = useSceneMode(telemetry.addContextLoss);
  useEffect(() => {
    telemetry.setMode(scene.mode, scene.reason === 'ok' ? null : scene.reason);
  }, [telemetry, scene.mode, scene.reason]);
  const inGame = snapshot?.status === 'IN_GAME' || showResult;
  const showGame = useCelebrationDelay(snapshot ? inGame : null, scene.mode === '3d');
  const resultReady = useCelebrationDelay(snapshot ? showResult : null, scene.mode === '3d', RESULT_DELAY_MS);
  const [muted, setMuted] = useMuted();
  useGameSounds(muted);
  useEffect(() => {
    if (scene.reason === 'context-lost') toast('Modo 2D ativado para economizar o aparelho');
    if (scene.reason === 'failed') toast('Não foi possível carregar o 3D; usando o modo 2D.');
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

  // Moedas mudam no servidor (cartela automática ao começar, vitória/derrota no fim): recarrega o saldo.
  useEffect(() => {
    if (inGame) void refresh();
  }, [inGame, showResult, refresh]);
  const lobbyActions = useMemo(
    () => ({
      ...actions,
      generateCard: async () => {
        await actions.generateCard();
        await refresh();
      },
    }),
    [actions, refresh],
  );

  async function leave() {
    await actions.leave();
    router.push('/');
  }

  if (exit) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4 py-10">
        <div className="glass flex flex-col gap-4 p-6 text-center" role="alert">
        <p className="font-display text-xl font-semibold">{exit.message ?? EXIT_MESSAGES[exit.reason]}</p>
        <Button asChild className="h-12 rounded-xl text-base">
          <Link href="/">Voltar ao início</Link>
        </Button>
        </div>
      </main>
    );
  }
  if (!snapshot) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-4" aria-busy="true">
        <MiniGlobe />
        <p className="font-display text-lg font-semibold text-amber-200">Entrando na sala…</p>
      </div>
    );
  }

  return (
    <>
      <ConnectionBanner status={connection} />
      {showGame ? (
        <GameView
          actions={actions}
          muted={muted}
          onToggleMute={setMuted}
          stage={
            scene.mode === '3d' ? (
              <StageErrorBoundary onError={scene.reportFailure}>
                <GameStageLazy key={scene.stageKey} roomName={snapshot.name} code={snapshot.code} qualityOverride={scene.quality} onContextLost={scene.reportContextLoss} onFrame={telemetry.addFrameDeltaMs} />
              </StageErrorBoundary>
            ) : undefined
          }
        />
      ) : (
        <>
          {scene.mode === '3d' && (
            <div className="h-[50dvh] w-full overflow-hidden rounded-b-[2rem] border-b-2 border-amber-300/50 shadow-[0_10px_40px_-10px_rgb(245_158_11/0.5)] landscape:h-[55dvh]">
              <StageErrorBoundary onError={scene.reportFailure}>
                <LobbyStageLazy
                  key={scene.stageKey}
                  roomName={snapshot.name}
                  code={snapshot.code}
                  celebrating={inGame}
                  qualityOverride={scene.quality}
                  onContextLost={scene.reportContextLoss}
                />
              </StageErrorBoundary>
            </div>
          )}
          <SceneControls mode={scene.mode} quality={scene.quality} onModeChange={scene.setPreferred} onQualityChange={scene.setQuality} />
          <LobbyView actions={lobbyActions} coins={profile.coins} onLeave={() => void leave()} />
        </>
      )}
      {showResult && resultReady && <ResultDialog onReplay={() => void actions.replay()} onLeave={() => void leave()} />}
    </>
  );
}

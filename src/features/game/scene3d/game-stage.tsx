'use client';

import { useMemo, useState } from 'react';
import { useGameStore } from '../store';
import { AvatarCrowd } from './avatar-crowd';
import { parseBots } from './bots';
import { CameraRig } from './camera-rig';
import { Confetti } from './confetti';
import { Globe } from './globe-mesh';
import { Hall } from './hall';
import { BOTS_ENABLED } from './lobby-stage';
import { NameLabels } from './name-labels';
import type { QualityOverride } from './quality';
import { slotPosition } from './slots';
import { StageCanvas } from './stage-canvas';
import { telaoView } from './telao';
import { useAvatarStates } from './use-avatar-states';

export interface GameStageProps {
  roomName: string;
  code: string;
  qualityOverride: QualityOverride;
  onContextLost: () => void;
}

const NO_DRAWS: readonly number[] = [];

/** Palco 3D da partida: telão, globo, plateia com "por 1" e cena de vitória. */
export default function GameStage({ roomName, code, qualityOverride, onContextLost }: GameStageProps) {
  const [bots] = useState(() => parseBots(window.location.search, BOTS_ENABLED));
  const { statesRef, list, dance } = useAvatarStates(bots);
  const drawn = useGameStore((s) => s.snapshot?.game?.drawn ?? NO_DRAWS);
  const winner = useGameStore((s) => s.winner);
  const ended = useGameStore((s) => s.endedWithoutWinner);
  const myUserId = useGameStore((s) => s.myUserId);

  const screen = useMemo(
    () => telaoView({ phase: 'game', name: roomName, code, drawn, winner: winner && { userId: winner.userId, nickname: winner.nickname }, ended, myUserId }),
    [roomName, code, drawn, winner, ended, myUserId],
  );
  const winnerState = winner ? list.find((s) => s.userId === winner.userId) : undefined;
  const focus = winnerState ? slotPosition(winnerState.slot) : null;

  return (
    <StageCanvas qualityOverride={qualityOverride} onContextLost={onContextLost}>
      {(settings, tier) => (
        <>
          <CameraRig view="game" focus={focus} />
          <Hall screen={screen} animatedBulbs={settings.animatedBulbs} shadows={settings.shadows === 'real'} />
          <Globe lastNumber={drawn.at(-1) ?? null} drawCount={drawn.length} innerBalls={tier === 'low' ? 8 : 18} />
          <AvatarCrowd statesRef={statesRef} onTap={dance} castShadow={settings.shadows === 'real'} fakeShadow={settings.shadows === 'fake'} />
          <NameLabels list={list} statesRef={statesRef} showAll={tier === 'high' || list.length <= 15} />
          {winner && settings.confetti > 0 && <Confetti count={settings.confetti} />}
        </>
      )}
    </StageCanvas>
  );
}

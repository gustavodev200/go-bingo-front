'use client';

import { useState } from 'react';
import { AvatarCrowd } from './avatar-crowd';
import { parseBots } from './bots';
import { CameraRig } from './camera-rig';
import { Confetti } from './confetti';
import { Globe } from './globe-mesh';
import { Hall } from './hall';
import { NameLabels } from './name-labels';
import type { QualityOverride } from './quality';
import { slotPosition } from './slots';
import { StageCanvas } from './stage-canvas';
import { useAvatarStates } from './use-avatar-states';

export interface LobbyStageProps {
  roomName: string;
  code: string;
  /** Partida começou: confete antes de trocar para a tela do jogo. */
  celebrating: boolean;
  qualityOverride: QualityOverride;
  onContextLost: () => void;
}

export const BOTS_ENABLED = process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_ENABLE_BOTS === '1';

/** Palco 3D do lobby. Carregado só via `next/dynamic` (ssr:false). */
export default function LobbyStage({ roomName, code, celebrating, qualityOverride, onContextLost }: LobbyStageProps) {
  const [bots] = useState(() => parseBots(window.location.search, BOTS_ENABLED));
  const { statesRef, list, dance } = useAvatarStates(bots);
  // Enquadra só quem está na sala: com poucos jogadores a câmera chega perto.
  const spread = Math.max(0, ...list.map((s) => Math.abs(slotPosition(s.slot)[0])));

  return (
    <StageCanvas qualityOverride={qualityOverride} onContextLost={onContextLost}>
      {(settings, tier) => (
        <>
          <CameraRig view="lobby" spread={spread} />
          <Hall screen={{ kind: 'lobby', name: roomName, code }} animatedBulbs={settings.animatedBulbs} shadows={settings.shadows === 'real'} tier={tier} />
          <Globe lastNumber={null} drawCount={0} innerBalls={tier === 'low' ? 8 : 18} />
          <AvatarCrowd statesRef={statesRef} onTap={dance} castShadow={settings.shadows === 'real'} fakeShadow={settings.shadows === 'fake'} />
          <NameLabels list={list} statesRef={statesRef} showAll={tier === 'high' || list.length <= 15} />
          {celebrating && settings.confetti > 0 && <Confetti count={settings.confetti} />}
        </>
      )}
    </StageCanvas>
  );
}

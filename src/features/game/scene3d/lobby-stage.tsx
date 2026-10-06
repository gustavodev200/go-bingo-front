'use client';

import { PerformanceMonitor } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { useEffect, useRef, useState } from 'react';
import { AvatarCrowd } from './avatar-crowd';
import { parseBots } from './bots';
import { CameraRig } from './camera-rig';
import { Confetti } from './confetti';
import { Hall } from './hall';
import { NameLabels } from './name-labels';
import { TIER_SETTINGS, initialQuality, pickInitialTier, stepDown, stepUp, type QualityOverride, type QualityState } from './quality';
import { useAvatarStates } from './use-avatar-states';

export interface LobbyStageProps {
  roomName: string;
  code: string;
  /** Partida começou: confete antes de trocar para a tela do jogo. */
  celebrating: boolean;
  qualityOverride: QualityOverride;
  onContextLost: () => void;
}

const BOTS_ENABLED = process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_ENABLE_BOTS === '1';

function startQuality(override: QualityOverride): QualityState {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const tier = override === 'auto' ? pickInitialTier({ cores: nav.hardwareConcurrency || 4, memoryGb: nav.deviceMemory ?? null, screenWidth: window.innerWidth }) : override;
  return initialQuality(tier, window.devicePixelRatio || 1);
}

function usePageHidden() {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    const update = () => setHidden(document.visibilityState === 'hidden');
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);
  return hidden;
}

/** Palco 3D do lobby. Carregado só via `next/dynamic` (ssr:false) — é o único ponto de entrada do three.js. */
export default function LobbyStage({ roomName, code, celebrating, qualityOverride, onContextLost }: LobbyStageProps) {
  const [quality, setQuality] = useState<QualityState>(() => startQuality(qualityOverride));
  const [appliedOverride, setAppliedOverride] = useState(qualityOverride);
  if (appliedOverride !== qualityOverride) {
    setAppliedOverride(qualityOverride);
    setQuality(startQuality(qualityOverride));
  }
  const [bots] = useState(() => parseBots(window.location.search, BOTS_ENABLED));
  const { statesRef, list, dance } = useAvatarStates(bots);
  const inclined = useRef(false);
  const hidden = usePageHidden();
  const settings = TIER_SETTINGS[quality.tier];

  return (
    <Canvas
      aria-hidden="true"
      role="presentation"
      dpr={quality.dpr}
      frameloop={hidden ? 'never' : 'always'}
      shadows={settings.shadows === 'real'}
      gl={{ antialias: settings.antialias, powerPreference: 'high-performance' }}
      camera={{ fov: 45, near: 0.1, far: 100, position: [0, 9, 20] }}
      style={{ touchAction: 'pan-y' }}
      onCreated={({ gl }) => {
        gl.domElement.addEventListener(
          'webglcontextlost',
          (event) => {
            event.preventDefault();
            onContextLost();
          },
          { once: true },
        );
      }}
    >
      {qualityOverride === 'auto' && (
        <PerformanceMonitor
          flipflops={3}
          onDecline={() => setQuality(stepDown)}
          onIncline={() => {
            if (inclined.current) return;
            inclined.current = true;
            setQuality(stepUp);
          }}
        />
      )}
      <color attach="background" args={['#2e1065']} />
      <fog attach="fog" args={['#2e1065', 18, 40]} />
      <CameraRig />
      <Hall roomName={roomName} code={code} animatedBulbs={settings.animatedBulbs} shadows={settings.shadows === 'real'} />
      <AvatarCrowd statesRef={statesRef} onTap={dance} castShadow={settings.shadows === 'real'} fakeShadow={settings.shadows === 'fake'} />
      <NameLabels list={list} statesRef={statesRef} showAll={quality.tier === 'high' || list.length <= 15} />
      {celebrating && settings.confetti > 0 && <Confetti count={settings.confetti} />}
    </Canvas>
  );
}

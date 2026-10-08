'use client';

import { Canvas } from '@react-three/fiber';
import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import type { CharacterId } from '@/contracts';
import { AvatarCrowd } from './avatar-crowd';
import { lookFor } from './characters';
import { PHASE_MS, type AvatarState, type Phase } from './pose';
import { slotPosition } from './slots';

/** Id fixo só para a vitrine (fase do piscar/respirar). */
const PREVIEW_ID = 'character-preview';
const [X, Y, Z] = slotPosition(0);

function previewState(character: CharacterId, phase: Phase): AvatarState {
  return {
    userId: PREVIEW_ID,
    slot: 0,
    look: lookFor(PREVIEW_ID, character),
    phase,
    phaseStart: performance.now(),
    isHost: false,
    connected: true,
    hasCard: false,
    lookAtDoorUntil: 0,
    oneAway: false,
  };
}

/**
 * Vitrine do seletor: o mesmo boneco 3D da sala, sozinho e de perto. Cada troca dá um pulinho (`ready-jump`) e volta ao idle.
 * Carregado só via `next/dynamic` (ssr:false); `fallback` aparece sem WebGL.
 */
export default function CharacterStage({ character, fallback }: { character: CharacterId; fallback: ReactNode }) {
  const statesRef = useRef(new Map<string, AvatarState>());
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  /** Toca uma animação curta e agenda a volta ao idle (a pose de dança/pulo não para sozinha). */
  const play = useCallback(
    (phase: 'ready-jump' | 'dance') => {
      clearTimeout(timer.current);
      statesRef.current = new Map([[PREVIEW_ID, previewState(character, phase)]]);
      timer.current = setTimeout(() => (statesRef.current = new Map([[PREVIEW_ID, previewState(character, 'idle')]])), PHASE_MS[phase]);
    },
    [character],
  );

  useEffect(() => {
    play('ready-jump');
    return () => clearTimeout(timer.current);
  }, [play]);

  return (
    <Canvas
      aria-hidden="true"
      role="presentation"
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true, stencil: false }}
      camera={{ fov: 30, near: 0.1, far: 20, position: [X, Y + 1.1, Z + 3.35] }}
      onCreated={({ camera }) => camera.lookAt(X, Y + 0.86, Z)}
      fallback={fallback}
      style={{ touchAction: 'pan-y' }}
    >
      {/* mesmas cores do salão (lilás em cima, magenta embaixo, contraluz rosa/ciano), sem o cenário */}
      <hemisphereLight args={['#c4b5fd', '#831843', 1.1]} />
      <ambientLight intensity={0.35} color="#fde7ff" />
      <directionalLight position={[X + 2.5, Y + 4, Z + 5]} intensity={1.8} color="#fff1d6" />
      <pointLight position={[X - 2, Y + 1.5, Z - 1]} intensity={6} color="#ec4899" distance={6} />
      <pointLight position={[X + 2, Y + 1.5, Z - 1]} intensity={6} color="#22d3ee" distance={6} />
      <AvatarCrowd statesRef={statesRef} onTap={() => play('dance')} castShadow={false} fakeShadow />
    </Canvas>
  );
}

'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { useCallback, useEffect, useRef, useState, type PointerEvent, type ReactNode, type RefObject } from 'react';
import type { Group } from 'three';
import type { CharacterId } from '@/contracts';
import { AvatarCrowd } from './avatar-crowd';
import { lookFor } from './characters';
import { FrameDriver } from './frame-driver';
import { PHASE_MS, type AvatarState, type Phase } from './pose';
import { TIER_SETTINGS } from './quality';
import { slotPosition } from './slots';
import { StageActivityContext, createStageActivity, useStageActivity } from './stage-activity';

/** Id fixo só para a vitrine (fase do piscar/respirar). */
const PREVIEW_ID = 'character-preview';
const [X, Y, Z] = slotPosition(0);
/** Radianos por pixel arrastado. */
const DRAG_RAD = 0.012;

function previewState(character: CharacterId, name: string, phase: Phase): AvatarState {
  return {
    userId: PREVIEW_ID,
    slot: 0,
    look: lookFor(PREVIEW_ID, character, name),
    phase,
    phaseStart: performance.now(),
    isHost: false,
    connected: true,
    hasCard: false,
    lookAtDoorUntil: 0,
    oneAway: false,
  };
}

/** Gira o boneco em volta do próprio eixo até o ângulo pedido (suave, independente de FPS). */
function Turntable({ yaw, children }: { yaw: RefObject<number>; children: ReactNode }) {
  const group = useRef<Group>(null);
  const activity = useStageActivity();
  useFrame((_, delta) => {
    const g = group.current;
    if (!g) return;
    const gap = yaw.current - g.rotation.y;
    if (Math.abs(gap) < 0.001) return;
    g.rotation.y += gap * (1 - Math.exp(-delta * 10));
    activity.keepActive(100);
  });
  return (
    <group ref={group} position={[X, Y, Z]}>
      <group position={[-X, -Y, -Z]}>{children}</group>
    </group>
  );
}

/**
 * Vitrine do seletor: o mesmo boneco 3D da sala, sozinho e de perto. Arrastar gira; `facing` vira de frente/costas.
 * Cada troca dá um pulinho (`ready-jump`) e volta ao idle; tocar faz dançar. Trocar camisa/rosto só reescreve
 * atributos da instância — o modelo não recarrega. Carregado só via `next/dynamic` (ssr:false); `fallback` sem WebGL.
 */
export default function CharacterStage({ character, name = '', facing = 'front', fallback }: { character: CharacterId; name?: string; facing?: 'front' | 'back'; fallback: ReactNode }) {
  const statesRef = useRef(new Map<string, AvatarState>());
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [activity] = useState(() => createStageActivity());
  const yaw = useRef(0);
  const drag = useRef<{ x: number; yaw: number } | null>(null);

  /** Toca uma animação curta e agenda a volta ao idle (a pose de dança/pulo não para sozinha). */
  const play = useCallback(
    (phase: 'ready-jump' | 'dance') => {
      clearTimeout(timer.current);
      statesRef.current = new Map([[PREVIEW_ID, previewState(character, name, phase)]]);
      activity.keepActive(PHASE_MS[phase]);
      timer.current = setTimeout(() => (statesRef.current = new Map([[PREVIEW_ID, previewState(character, name, 'idle')]])), PHASE_MS[phase]);
    },
    [character, name, activity],
  );

  useEffect(() => {
    play('ready-jump');
    return () => clearTimeout(timer.current);
  }, [play]);

  useEffect(() => {
    // vira pelo caminho mais curto a partir de onde o arrasto deixou
    const target = facing === 'back' ? Math.PI : 0;
    yaw.current = target + Math.round((yaw.current - target) / (Math.PI * 2)) * Math.PI * 2;
    activity.keepActive(800);
  }, [facing, activity]);

  function onPointerMove(e: PointerEvent) {
    if (!drag.current) return;
    yaw.current = drag.current.yaw + (e.clientX - drag.current.x) * DRAG_RAD;
    activity.keepActive(300);
  }

  return (
    <div
      className="size-full cursor-grab active:cursor-grabbing"
      onPointerDown={(e) => (drag.current = { x: e.clientX, yaw: yaw.current })}
      onPointerMove={onPointerMove}
      onPointerUp={() => (drag.current = null)}
      onPointerLeave={() => (drag.current = null)}
      onPointerCancel={() => (drag.current = null)}
    >
      <Canvas
        aria-hidden="true"
        role="presentation"
        dpr={[1, 2]}
        // Um boneco parado respirando não precisa de 60-120 FPS: pulo/dança/giro sobem para o teto ativo.
        frameloop="demand"
        gl={{ antialias: true, alpha: true, stencil: false }}
        camera={{ fov: 30, near: 0.1, far: 20, position: [X, Y + 1.1, Z + 3.35] }}
        onCreated={({ camera }) => camera.lookAt(X, Y + 0.86, Z)}
        fallback={fallback}
        style={{ touchAction: 'pan-y' }}
      >
        {/* mesmas cores do salão (lilás em cima, magenta embaixo, contraluz rosa/ciano), sem o cenário */}
        <hemisphereLight args={['#c4b5fd', '#831843', 1.1]} />
        <ambientLight intensity={0.4} color="#fde7ff" />
        <directionalLight position={[X + 2.5, Y + 4, Z + 5]} intensity={1.8} color="#fff1d6" />
        <directionalLight position={[X - 2, Y + 3, Z - 5]} intensity={1.1} color="#e0e7ff" />
        <pointLight position={[X - 2, Y + 1.5, Z - 1]} intensity={6} color="#ec4899" distance={6} />
        <pointLight position={[X + 2, Y + 1.5, Z - 1]} intensity={6} color="#22d3ee" distance={6} />
        <StageActivityContext.Provider value={activity}>
          <FrameDriver settings={TIER_SETTINGS.medium} />
          <Turntable yaw={yaw}>
            <AvatarCrowd statesRef={statesRef} onTap={() => play('dance')} castShadow={false} fakeShadow />
          </Turntable>
        </StageActivityContext.Provider>
      </Canvas>
    </div>
  );
}

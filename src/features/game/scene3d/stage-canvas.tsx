'use client';

import { Preload } from '@react-three/drei';
import { Canvas, useThree } from '@react-three/fiber';
import { useCallback, useEffect, useLayoutEffect, useState, type ReactNode } from 'react';
import { contextLossGuard } from './context-loss';
import { FrameDriver } from './frame-driver';
import { TIER_SETTINGS, initialQuality, pickInitialTier, stepDown, stepUp, type QualityOverride, type QualityState, type Tier, type TierSettings } from './quality';
import { StageActivityContext, createStageActivity } from './stage-activity';

function startQuality(override: QualityOverride): QualityState {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const tier = override === 'auto' ? pickInitialTier({ cores: nav.hardwareConcurrency || 4, memoryGb: nav.deviceMemory ?? null, screenWidth: window.innerWidth }) : override;
  return initialQuality(tier, window.devicePixelRatio || 1);
}

/**
 * Escuta perda de contexto real. O cleanup roda quando a cena desmonta, antes de o R3F descartar o renderer
 * (que força uma perda de propósito) — essa não pode contar como falha do aparelho.
 */
function ContextLossWatcher({ onLost }: { onLost: () => void }) {
  const gl = useThree((s) => s.gl);
  useLayoutEffect(() => {
    const guard = contextLossGuard(onLost);
    const canvas = gl.domElement;
    canvas.addEventListener('webglcontextlost', guard.handle);
    return () => {
      guard.dispose();
      canvas.removeEventListener('webglcontextlost', guard.handle);
    };
  }, [gl, onLost]);
  return null;
}

let mountedStages = 0;

/**
 * `<html data-stage>` enquanto um palco 3D está montado: o fundo CSS animado (holofotes, chão) fica quase todo atrás
 * do canvas e pausa (stage.module.css) — sem repintar/recompor a tela inteira por baixo da cena.
 */
function useStageFlag() {
  useEffect(() => {
    mountedStages += 1;
    document.documentElement.dataset.stage = '';
    return () => {
      mountedStages -= 1;
      if (mountedStages === 0) delete document.documentElement.dataset.stage;
    };
  }, []);
}

/** Canvas comum do lobby e da partida: qualidade adaptativa, DPR, teto de FPS, pausa em segundo plano/fora da tela, perda de contexto. */
export function StageCanvas({
  qualityOverride,
  onContextLost,
  children,
}: {
  qualityOverride: QualityOverride;
  onContextLost: () => void;
  children: (settings: TierSettings, tier: Tier) => ReactNode;
}) {
  const [quality, setQuality] = useState<QualityState>(() => startQuality(qualityOverride));
  const [appliedOverride, setAppliedOverride] = useState(qualityOverride);
  if (appliedOverride !== qualityOverride) {
    setAppliedOverride(qualityOverride);
    setQuality(startQuality(qualityOverride));
  }
  const [activity] = useState(() => createStageActivity());
  const settings = TIER_SETTINGS[quality.tier];
  const decline = useCallback(() => setQuality(stepDown), []);
  const incline = useCallback(() => setQuality(stepUp), []);
  useStageFlag();

  return (
    <Canvas
      aria-hidden="true"
      role="presentation"
      dpr={quality.dpr}
      // Sob demanda: o FrameDriver pede quadros no teto do perfil e para com a aba oculta ou o canvas fora da tela.
      frameloop="demand"
      shadows={settings.shadows === 'real'}
      // stencil: nenhum efeito usa; sem ele o framebuffer fica menor (menos banda de memória no celular).
      // powerPreference 'default': 'high-performance' acordava a GPU dedicada em notebook híbrido (bateria) sem ganho para esta cena.
      gl={{ antialias: settings.antialias, powerPreference: 'default', stencil: false }}
      camera={{ fov: 45, near: 0.1, far: 100, position: [0, 9, 20] }}
      style={{ touchAction: 'pan-y' }}
    >
      <ContextLossWatcher onLost={onContextLost} />
      <StageActivityContext.Provider value={activity}>
        {/* Qualidade manual não adapta; "auto" desce/sobe pelo que o aparelho entrega de fato. */}
        <FrameDriver settings={settings} onDecline={qualityOverride === 'auto' ? decline : undefined} onIncline={qualityOverride === 'auto' ? incline : undefined} />
        <color attach="background" args={['#1a0b3d']} />
        <fog attach="fog" args={['#1a0b3d', 24, 60]} />
        {children(settings, quality.tier)}
        {/* Compila todos os shaders (inclusive de objetos escondidos, como o confete) na montagem: sem engasgo na 1ª aparição. */}
        <Preload all />
      </StageActivityContext.Provider>
    </Canvas>
  );
}

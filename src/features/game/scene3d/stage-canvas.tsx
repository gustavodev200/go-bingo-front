'use client';

import { PerformanceMonitor } from '@react-three/drei';
import { Canvas, useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { contextLossGuard } from './context-loss';
import { TIER_SETTINGS, initialQuality, pickInitialTier, stepDown, stepUp, type QualityOverride, type QualityState, type Tier, type TierSettings } from './quality';

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

function usePageHidden() {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    const update = () => setHidden(document.visibilityState === 'hidden');
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);
  return hidden;
}

/** Canvas comum do lobby e da partida: qualidade adaptativa, DPR, pausa em segundo plano, perda de contexto. */
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
    >
      <ContextLossWatcher onLost={onContextLost} />
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
      {children(settings, quality.tier)}
    </Canvas>
  );
}

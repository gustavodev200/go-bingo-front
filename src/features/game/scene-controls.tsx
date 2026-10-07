'use client';

import { Button } from '@/components/ui/button';
import type { DisplayMode } from './scene3d/display-mode';
import type { QualityOverride } from './scene3d/quality';

const QUALITY_LABELS: Record<QualityOverride, string> = { auto: 'Automática', high: 'Alta', medium: 'Média', low: 'Baixa' };

export function SceneControls({
  mode,
  quality,
  onModeChange,
  onQualityChange,
}: {
  mode: DisplayMode;
  quality: QualityOverride;
  onModeChange: (mode: DisplayMode) => void;
  onQualityChange: (quality: QualityOverride) => void;
}) {
  return (
    <div className="mx-auto flex w-full max-w-md items-center justify-end gap-2 px-4 pt-2 text-sm">
      {mode === '3d' && (
        <select
          aria-label="Qualidade 3D"
          className="h-9 rounded-full border border-white/15 bg-white/5 px-3 backdrop-blur-sm [&>option]:bg-violet-950"
          value={quality}
          onChange={(e) => onQualityChange(e.target.value as QualityOverride)}
        >
          {(Object.keys(QUALITY_LABELS) as QualityOverride[]).map((q) => (
            <option key={q} value={q}>
              {QUALITY_LABELS[q]}
            </option>
          ))}
        </select>
      )}
      <Button variant="outline" size="sm" className="h-9 rounded-full px-3" onClick={() => onModeChange(mode === '3d' ? '2d' : '3d')}>
        {mode === '3d' ? 'Ver em 2D' : 'Ver em 3D'}
      </Button>
    </div>
  );
}

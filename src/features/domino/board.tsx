'use client';

import { memo, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import type { DominoPlaced, DominoSide } from '@/contracts';
import { cn } from '@/lib/utils';
import { halfWidthFor, layoutLine, type LaidTile } from './board-layout';
import { TileFace } from './domino-tile';
import { tileLabel } from './rules-view';
import styles from './domino.module.css';

const keyOf = (p: DominoPlaced) => `${Math.min(p.a, p.b)}${Math.max(p.a, p.b)}`;

const PlacedTile = memo(function PlacedTile({ tile, last }: { tile: LaidTile; last: boolean }) {
  return (
    <g transform={`translate(${tile.x} ${tile.y})${tile.vertical ? ' rotate(90)' : ''}`} className={cn(last && styles.last)}>
      <g className={cn(last && styles.drop)}>
        <TileFace first={tile.first} second={tile.second} />
      </g>
    </g>
  );
});

/** Aspect ratio (width / height) of an element, kept live. */
function useAspect(): [RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement>(null);
  const [aspect, setAspect] = useState(1.4);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) setAspect(Math.round((width / height) * 10) / 10);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, aspect];
}

/**
 * The line of tiles on the felt, drawn in SVG so it scales to any screen. It
 * snakes inside a band sized to the board area, doubles lie across, and the
 * tile just played is outlined. While a tile that fits both ends is selected,
 * both ends glow and can be tapped.
 */
export function Board({ line, origin, ends, choosing, onPick }: { line: DominoPlaced[]; origin: number; ends: [number, number] | null; choosing: boolean; onPick(side: DominoSide): void }) {
  const [ref, aspect] = useAspect();
  const halfWidth = halfWidthFor(aspect);
  const layout = useMemo(() => layoutLine(line, origin, halfWidth), [line, origin, halfWidth]);

  // The tile just played is the one that made the line grow (adjusted while rendering, no effect needed).
  const [seen, setSeen] = useState({ length: line.length, origin, last: null as string | null });
  if (seen.length !== line.length || seen.origin !== origin) {
    const grew = line.length === seen.length + 1;
    setSeen({ length: line.length, origin, last: grew ? keyOf(origin > seen.origin ? line[0] : line[line.length - 1]) : null });
  }

  const { box } = layout;
  // Never zoom in past a full band, so tiles keep their size as the line grows.
  const width = Math.max(box.maxX - box.minX, 2 * halfWidth + 2);
  const height = Math.max(box.maxY - box.minY, width / aspect, 5);
  const cx = (box.minX + box.maxX) / 2;
  const cy = (box.minY + box.maxY) / 2;
  const viewBox = `${cx - width / 2} ${cy - height / 2} ${width} ${height}`;
  const label = line.length === 0 ? 'Mesa vazia' : `Mesa com ${line.length} ${line.length === 1 ? 'peça' : 'peças'}; pontas ${ends![0]} e ${ends![1]}`;

  return (
    <div ref={ref} className="relative h-full w-full">
      <svg viewBox={viewBox} className="absolute inset-0 h-full w-full" role="img" aria-label={label}>
        {layout.tiles.map((t) => {
          const placed = line[t.index];
          return <PlacedTile key={keyOf(placed)} tile={t} last={keyOf(placed) === seen.last} />;
        })}
        {choosing &&
          layout.ends &&
          ends &&
          (['left', 'right'] as const).map((side) => {
            const p = layout.ends![side];
            return (
              <g
                key={side}
                transform={`translate(${p.x} ${p.y})`}
                className={styles.endSpot}
                role="button"
                tabIndex={0}
                aria-label={`Jogar na ponta ${side === 'left' ? 'esquerda' : 'direita'} (${side === 'left' ? ends[0] : ends[1]})`}
                onClick={() => onPick(side)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') onPick(side);
                }}
              >
                <circle r={0.62} fill="rgb(250 204 21 / 0.35)" stroke="#facc15" strokeWidth={0.08} />
                <text textAnchor="middle" dominantBaseline="central" fontSize={0.7} fontWeight={900} fill="#fff">
                  {side === 'left' ? ends[0] : ends[1]}
                </text>
              </g>
            );
          })}
      </svg>
      {line.length === 0 && <p className="pointer-events-none absolute inset-0 flex items-center justify-center px-6 text-center text-sm font-semibold text-white/70">Esperando a primeira peça…</p>}
      <span className="sr-only">{line.map((p) => tileLabel(p)).join(', ')}</span>
    </div>
  );
}

'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useRef, type KeyboardEvent, type PointerEvent } from 'react';
import { Avatar } from '@/components/stage/avatar';
import { Button } from '@/components/ui/button';
import { CHARACTER_IDS, type CharacterId } from '@/contracts';
import { CHARACTERS } from '@/features/game/scene3d/characters';

// three.js só baixa em quem abre o seletor (apelido/perfil); Home, /create e ranking continuam sem ele.
const CharacterStage = dynamic(() => import('@/features/game/scene3d/character-stage'), {
  ssr: false,
  loading: () => <span aria-hidden className="size-28 animate-pulse rounded-full bg-violet-300/10" />,
});

/** Distância mínima (px) de um arrasto horizontal para contar como "passar" o personagem. */
const SWIPE_PX = 40;

/** Seletor de personagem: boneco 3D no meio, setas ← → (também teclado e arrasto), volta ao início no fim da lista. */
export function CharacterPicker({ value, onChange, label }: { value: CharacterId; onChange: (id: CharacterId) => void; label?: string }) {
  const index = CHARACTER_IDS.indexOf(value);
  const swipeFrom = useRef<number | null>(null);
  const step = (delta: number) => onChange(CHARACTER_IDS[(index + delta + CHARACTER_IDS.length) % CHARACTER_IDS.length]);

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'ArrowLeft') step(-1);
    else if (e.key === 'ArrowRight') step(1);
    else return;
    e.preventDefault();
  }
  function onPointerUp(e: PointerEvent) {
    const from = swipeFrom.current;
    swipeFrom.current = null;
    if (from === null || Math.abs(e.clientX - from) < SWIPE_PX) return;
    step(e.clientX < from ? 1 : -1);
  }

  return (
    <div role="group" aria-label="Escolha seu personagem" aria-roledescription="carrossel" tabIndex={0} onKeyDown={onKeyDown} className="flex flex-col items-center gap-1 rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-amber-300/70">
      {label !== undefined && (
        <span aria-hidden className="font-display max-w-full truncate px-2 text-xl font-bold text-yellow-300 [-webkit-text-stroke:1px_#1e1b4b] [paint-order:stroke_fill]">
          {label || '???'}
        </span>
      )}
      <div className="flex w-full items-center justify-between gap-2">
        <Button type="button" variant="ghost" size="icon" className="size-12 shrink-0 rounded-full bg-white/5 text-amber-200 ring-1 ring-white/10" aria-label="Personagem anterior" onClick={() => step(-1)}>
          <ChevronLeft aria-hidden className="size-7" />
        </Button>
        <div
          className="relative flex h-64 min-w-0 flex-1 items-center justify-center"
          onPointerDown={(e) => (swipeFrom.current = e.clientX)}
          onPointerUp={onPointerUp}
          onPointerCancel={() => (swipeFrom.current = null)}
        >
          {/* holofote atrás do boneco */}
          <div aria-hidden className="absolute inset-x-6 top-0 bottom-4 bg-[radial-gradient(ellipse_at_center,rgb(253_230_138/0.22),transparent_65%)]" />
          <div className="absolute inset-0">
            <CharacterStage character={value} fallback={<Avatar look={{ ...CHARACTERS[value], seed: 0 }} className="mx-auto mt-10 w-24" />} />
          </div>
        </div>
        <Button type="button" variant="ghost" size="icon" className="size-12 shrink-0 rounded-full bg-white/5 text-amber-200 ring-1 ring-white/10" aria-label="Próximo personagem" onClick={() => step(1)}>
          <ChevronRight aria-hidden className="size-7" />
        </Button>
      </div>
      <p aria-live="polite" className="text-xs font-semibold text-violet-200/80 tabular-nums">
        Personagem {index + 1} de {CHARACTER_IDS.length}
      </p>
    </div>
  );
}

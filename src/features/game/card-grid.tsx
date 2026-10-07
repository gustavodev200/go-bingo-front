'use client';

import { BingoBall } from '@/components/stage/stage';
import { BINGO_LETTERS, FREE_CELL, FREE_INDEX, letterFor } from '@/contracts';
import { cn } from '@/lib/utils';

interface CardGridProps {
  grid: readonly number[];
  marked: readonly number[];
  drawn: ReadonlySet<number>;
  onMark?: (index: number) => void;
  onLocked?: (number: number) => void;
}

/**
 * Cartela de papel: casas creme, marcado leva o "carimbo" magenta.
 * Como no bingo de verdade, a cartela não entrega o que já saiu: quem não prestar atenção esquece de marcar.
 */
export function CardGrid({ grid, marked, drawn, onMark, onLocked }: CardGridProps) {
  const markedSet = new Set(marked);
  const cells: number[] = [];
  for (let row = 0; row < 5; row++) for (let col = 0; col < 5; col++) cells.push(col * 5 + row);

  return (
    <div className="mx-auto w-full max-w-md rounded-2xl bg-linear-to-b from-fuchsia-800 to-violet-950 p-2 shadow-[0_0_0_2px_rgb(251_191_36/0.6),0_0_40px_-10px_rgb(245_158_11/0.6)]">
      <div className="grid touch-manipulation grid-cols-5 gap-1.5 select-none">
        {BINGO_LETTERS.map((letter) => (
          <div key={letter} className="flex justify-center pb-0.5" aria-hidden="true">
            <BingoBall letter={letter} className="w-8" faceClassName="text-sm">
              {letter}
            </BingoBall>
          </div>
        ))}
        {cells.map((index) => {
          const number = grid[index];
          const free = index === FREE_INDEX || number === FREE_CELL;
          const isMarked = free || markedSet.has(index);
          const isDrawn = !free && drawn.has(number);
          const label = free ? 'Casa livre' : `${letterFor(number)} ${number}${isMarked ? ', marcado' : ''}`;

          function click() {
            if (free || isMarked || !onMark) return;
            if (!isDrawn) return onLocked?.(number);
            onMark(index);
          }

          return (
            <button
              key={index}
              type="button"
              aria-label={label}
              aria-pressed={isMarked}
              onClick={click}
              className={cn(
                'font-display relative isolate flex aspect-6/5 min-h-11 min-w-11 items-center justify-center overflow-hidden rounded-lg bg-amber-50 text-xl font-bold text-violet-950 shadow-[inset_0_-3px_0_rgb(0_0_0/0.12)] transition active:scale-95',
                // carimbo: círculo magenta atrás do número
                'before:absolute before:top-[10%] before:bottom-[10%] before:left-1/2 before:aspect-square before:-translate-x-1/2 before:-z-10 before:scale-0 before:rounded-full before:bg-pink-500/90 before:transition-transform before:duration-200',
                isMarked && 'text-white before:scale-100',
                free && 'before:bg-linear-to-b before:from-amber-300 before:to-amber-500 text-violet-950',
              )}
            >
              {free ? '★' : number}
            </button>
          );
        })}
      </div>
    </div>
  );
}

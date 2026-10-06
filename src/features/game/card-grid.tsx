'use client';

import { BINGO_LETTERS, FREE_CELL, FREE_INDEX, letterFor } from '@/contracts';
import { cn } from '@/lib/utils';

interface CardGridProps {
  grid: readonly number[];
  marked: readonly number[];
  drawn: ReadonlySet<number>;
  onMark?: (index: number) => void;
  onLocked?: (number: number) => void;
}

export function CardGrid({ grid, marked, drawn, onMark, onLocked }: CardGridProps) {
  const markedSet = new Set(marked);
  const cells: number[] = [];
  for (let row = 0; row < 5; row++) for (let col = 0; col < 5; col++) cells.push(col * 5 + row);

  return (
    <div className="mx-auto grid w-full max-w-md touch-manipulation grid-cols-5 gap-1.5 select-none">
      {BINGO_LETTERS.map((letter) => (
        <div key={letter} className="text-primary text-center text-lg font-black" aria-hidden="true">
          {letter}
        </div>
      ))}
      {cells.map((index) => {
        const number = grid[index];
        const free = index === FREE_INDEX || number === FREE_CELL;
        const isMarked = free || markedSet.has(index);
        const isDrawn = !free && drawn.has(number);
        const label = free ? 'Casa livre' : `${letterFor(number)} ${number}${isMarked ? ', marcado' : isDrawn ? ', sorteado' : ''}`;

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
              'flex aspect-square min-h-11 min-w-11 items-center justify-center rounded-md border text-lg font-bold transition-colors',
              isMarked && 'bg-primary text-primary-foreground border-primary',
              !isMarked && isDrawn && 'border-primary ring-primary/60 animate-pulse ring-2',
              !isMarked && !isDrawn && 'bg-muted/40 text-foreground/80',
            )}
          >
            {free ? '★' : number}
          </button>
        );
      })}
    </div>
  );
}

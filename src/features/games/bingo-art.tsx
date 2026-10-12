import { BingoBall, MiniGlobe } from '@/components/stage/stage';
import { LETTER_COLORS } from '@/features/game/scene3d/ambience';

const LETTERS = Object.keys(LETTER_COLORS) as (keyof typeof LETTER_COLORS)[];

/** Bingo card illustration: the golden globe with the B-I-N-G-O balls bobbing around it. Decorative. */
export function BingoArt() {
  return (
    <div aria-hidden className="relative flex h-full flex-col items-center justify-center gap-3 bg-[radial-gradient(ellipse_at_50%_35%,#7c3aed_0%,#4c1d95_50%,#1e0b3d_100%)]">
      <div className="transition-transform duration-500 group-hover:scale-110 motion-reduce:transition-none">
        <MiniGlobe />
      </div>
      <div className="flex gap-1.5">
        {LETTERS.map((letter, i) => (
          <BingoBall key={letter} letter={letter} bob delay={i * 0.35} className="w-8" faceClassName="text-xs">
            {letter}
          </BingoBall>
        ))}
      </div>
    </div>
  );
}

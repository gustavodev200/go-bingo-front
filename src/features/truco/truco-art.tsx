import { PlayingCard } from '@/features/truco/playing-card';

/** Truco card illustration: the four manilhas fanned on green felt. Decorative. */
export function TrucoArt() {
  return (
    <div aria-hidden className="relative flex h-full items-center justify-center bg-[radial-gradient(ellipse_at_50%_40%,#22a45d_0%,#146b3e_55%,#0a3d24_100%)]">
      <div className="flex items-end transition-transform duration-500 group-hover:scale-110 motion-reduce:transition-none">
        <PlayingCard card={{ rank: '7', suit: 'diamonds' }} size="sm" className="translate-y-2 -rotate-[18deg]" />
        <PlayingCard card={{ rank: 'A', suit: 'spades' }} size="sm" className="-ml-3 translate-y-0.5 -rotate-6" />
        <PlayingCard card={{ rank: '7', suit: 'hearts' }} size="sm" className="-ml-3 translate-y-0.5 rotate-6" />
        <PlayingCard card={{ rank: '4', suit: 'clubs' }} size="sm" className="-ml-3 translate-y-2 rotate-[18deg]" />
      </div>
      <span className="font-display absolute right-4 bottom-3 -rotate-6 rounded-xl border-2 border-white bg-amber-300 px-2 text-lg font-black text-red-800 shadow-lg">TRUCO!</span>
    </div>
  );
}

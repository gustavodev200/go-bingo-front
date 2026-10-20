import { SpanishCard } from './spanish-card';

/** Ilustração do Truco Gaudério: as quatro manilhas em leque sobre o feltro. Decorativa. */
export function GauderioArt() {
  return (
    <div aria-hidden className="relative flex h-full items-center justify-center bg-[radial-gradient(ellipse_at_50%_40%,#3f8f55_0%,#1f5a33_55%,#0f2f1b_100%)]">
      <div className="flex items-end transition-transform duration-500 group-hover:scale-110 motion-reduce:transition-none">
        <SpanishCard card={{ rank: 7, suit: 'ouros' }} size="sm" className="translate-y-2 -rotate-[18deg]" />
        <SpanishCard card={{ rank: 7, suit: 'espadas' }} size="sm" className="-ml-3 translate-y-0.5 -rotate-6" />
        <SpanishCard card={{ rank: 1, suit: 'paus' }} size="sm" className="-ml-3 translate-y-0.5 rotate-6" />
        <SpanishCard card={{ rank: 1, suit: 'espadas' }} size="sm" className="-ml-3 translate-y-2 rotate-[18deg]" />
      </div>
      <span className="font-display absolute right-4 bottom-3 -rotate-6 rounded-xl border-2 border-white bg-sky-300 px-2 text-lg font-black text-sky-950 shadow-lg">ENVIDO!</span>
      <span className="absolute top-3 left-4 text-2xl">🧉</span>
    </div>
  );
}

const MAP = ['#########', '#..%.%..#', '#.#%#.#%#', '#%..B.%.#', '#.#.#%#.#', '#########'];
/** Flames to both sides of the bomb at (4,3); the pillars above and below stop the rest. */
const FLAME: Record<string, string> = { '2,3': 'h', '3,3': 'h', '5,3': 'h' };

function Tile({ c, flame }: { c: string; flame?: string }) {
  if (c === '#') return <span className="rounded-[3px] border-2 border-t-slate-100 border-r-slate-500 border-b-slate-500 border-l-slate-100 bg-slate-300" />;
  if (c === '%')
    return <span className="bg-slate-400 bg-[repeating-linear-gradient(0deg,#64748b_0_2px,transparent_2px_8px),repeating-linear-gradient(90deg,#64748b_0_2px,transparent_2px_14px)]" />;
  return (
    <span className="relative flex items-center justify-center bg-green-600">
      {flame && <span className={flame === 'h' ? 'absolute inset-x-0 top-1/2 h-1/2 -translate-y-1/2 bg-linear-to-b from-orange-500 via-yellow-200 to-orange-500' : 'absolute inset-y-0 left-1/2 w-1/2 -translate-x-1/2 bg-linear-to-r from-orange-500 via-yellow-200 to-orange-500'} />}
      {c === 'B' && <span className="relative text-2xl leading-none drop-shadow-[0_0_8px_rgb(251_146_60)] motion-safe:animate-pulse">💣</span>}
    </span>
  );
}

/** Bomberman card illustration: a tiny arena with a bomb going off. Decorative. */
export function BomberArt() {
  return (
    <div aria-hidden className="flex h-full items-center justify-center bg-[radial-gradient(ellipse_at_50%_40%,#facc15_0%,#f59e0b_55%,#9a3412_100%)]">
      <div className="grid aspect-9/6 w-[78%] max-w-72 grid-cols-9 grid-rows-6 overflow-hidden rounded-lg shadow-[0_10px_30px_-6px_rgb(0_0_0/0.6)] ring-2 ring-black/60 transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none">
        {MAP.flatMap((row, y) => [...row].map((c, x) => <Tile key={`${x},${y}`} c={c} flame={FLAME[`${x},${y}`]} />))}
      </div>
    </div>
  );
}

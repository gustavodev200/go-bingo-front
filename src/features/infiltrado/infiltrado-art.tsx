import { INF_COLORS } from '@/contracts';

/** A diver silhouette in CSS (no canvas: the hub renders many cards). */
function Diver({ color, className, sus }: { color: number; className?: string; sus?: boolean }) {
  const c = INF_COLORS[color];
  return (
    <span className={`relative inline-block ${className ?? ''}`} style={{ width: 44, height: 56 }}>
      <span className="absolute bottom-0 left-1/2 h-9 w-11 -translate-x-1/2 rounded-[50%] border-2 border-slate-950" style={{ background: `linear-gradient(135deg, ${c.body}, ${c.shade})` }} />
      <span className="absolute top-0 left-1/2 size-7 -translate-x-1/2 rounded-full border-2 border-sky-100/80 bg-slate-900/90">
        <span className={`absolute top-2 left-1.5 h-2 w-1.5 rounded-full ${sus ? 'bg-red-400' : 'bg-white'}`} />
        <span className={`absolute top-2 right-1.5 h-2 w-1.5 rounded-full ${sus ? 'bg-red-400' : 'bg-white'}`} />
      </span>
      <span className="absolute top-[22px] left-1/2 h-2 w-8 -translate-x-1/2 rounded-full bg-amber-500" />
    </span>
  );
}

/** Infiltrado card illustration: divers in the deep, one of them with red eyes. Decorative. */
export function InfiltradoArt() {
  return (
    <div
      aria-hidden
      className="relative flex h-full items-end justify-center gap-1 overflow-hidden bg-[radial-gradient(ellipse_at_50%_0%,#22d3ee55,transparent_60%),linear-gradient(#0c3b57,#020b16)] pb-4"
    >
      {[18, 42, 66, 84].map((left, i) => (
        <span
          key={left}
          className="absolute size-2 rounded-full border border-sky-200/60 motion-safe:animate-bounce"
          style={{ left: `${left}%`, top: `${20 + i * 12}%`, animationDelay: `${i * 0.3}s` }}
        />
      ))}
      <div className="flex items-end gap-2 transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none">
        <Diver color={1} />
        <Diver color={0} className="-translate-y-2 scale-110" sus />
        <Diver color={2} />
        <Diver color={5} />
      </div>
    </div>
  );
}

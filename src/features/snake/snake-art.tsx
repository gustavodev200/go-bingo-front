/** Body of the card snake: [x%, y%] from tail to head along an S. */
const BODY = Array.from({ length: 22 }, (_, i) => {
  const t = i / 21;
  return [12 + t * 70, 52 + Math.sin(t * Math.PI * 2 + 0.3) * 20 * (0.4 + t * 0.6)] as const;
});
const PELLETS = [
  [20, 22, '#ff4f6d'],
  [78, 20, '#38b6ff'],
  [88, 70, '#ffd23f'],
  [30, 80, '#c77dff'],
  [55, 30, '#00f5d4'],
] as const;

/** Snake.io card illustration: a neon snake on the hex arena with glowing pellets. Decorative. */
export function SnakeArt() {
  const [hx, hy] = BODY[BODY.length - 1];
  return (
    <div aria-hidden className="relative h-full overflow-hidden bg-[radial-gradient(ellipse_at_50%_45%,#1b2a55_0%,#0d1328_70%)]">
      <div className="absolute inset-0 opacity-40 bg-[radial-gradient(circle,#2a3d78_1.5px,transparent_2px)] bg-size-[18px_16px]" />
      {PELLETS.map(([x, y, c]) => (
        <span
          key={`${x},${y}`}
          className="absolute size-2.5 -translate-1/2 rounded-full motion-safe:animate-pulse"
          style={{
            left: `${x}%`,
            top: `${y}%`,
            background: c,
            boxShadow: `0 0 12px 3px ${c}`,
          }}
        />
      ))}
      <div className="absolute inset-0 transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none">
        {BODY.map(([x, y], i) => (
          <span
            key={i}
            className="absolute size-7 -translate-1/2 rounded-full border-2 border-black/50"
            style={{
              left: `${x}%`,
              top: `${y}%`,
              background: Math.floor(i / 3) % 2 ? '#ffd23f' : '#3cf27a',
            }}
          />
        ))}
        <span className="absolute flex -translate-1/2 gap-0.5" style={{ left: `${hx + 1}%`, top: `${hy}%` }}>
          <span className="grid size-3 place-items-center rounded-full bg-white">
            <span className="size-1.5 rounded-full bg-slate-900" />
          </span>
          <span className="grid size-3 place-items-center rounded-full bg-white">
            <span className="size-1.5 rounded-full bg-slate-900" />
          </span>
        </span>
      </div>
    </div>
  );
}

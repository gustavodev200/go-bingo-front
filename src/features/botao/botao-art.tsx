/** Ilustração do card: meio-campo com botões dos dois times e a bola. Decorativa. */
export function BotaoArt() {
  const disc = (cx: number, cy: number, fill: string, label: string, ring = false) => (
    <g key={`${cx},${cy}`}>
      <circle cx={cx + 1.5} cy={cy + 2} r="9" fill="rgb(0 0 0 / 0.25)" />
      <circle cx={cx} cy={cy} r="9" fill={fill} stroke={ring ? '#fff' : '#111'} strokeWidth={ring ? 2.2 : 1.4} />
      <text x={cx} y={cy + 3.2} textAnchor="middle" fontSize="9" fontWeight="800" fill="#fff" fontFamily="system-ui, sans-serif">
        {label}
      </text>
    </g>
  );
  return (
    <div aria-hidden className="flex h-full items-center justify-center bg-[radial-gradient(ellipse_at_50%_35%,#86efac_0%,#16a34a_55%,#14532d_100%)]">
      <svg
        viewBox="0 0 200 110"
        className="w-[82%] max-w-80 rounded-lg shadow-[0_10px_30px_-6px_rgb(0_0_0/0.6)] ring-2 ring-black/50 transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none"
      >
        <rect width="200" height="110" fill="#4a7a36" />
        {Array.from({ length: 8 }, (_, i) => (
          <rect key={i} x={12 + i * 22} y="10" width="22" height="90" fill={i % 2 ? '#5d9a43' : '#56903d'} />
        ))}
        <g fill="none" stroke="rgb(240 255 232 / 0.9)" strokeWidth="1.5">
          <rect x="12" y="10" width="176" height="90" />
          <line x1="100" y1="10" x2="100" y2="100" />
          <circle cx="100" cy="55" r="16" />
        </g>
        <rect x="4" y="40" width="8" height="30" fill="rgb(15 30 15 / 0.4)" stroke="#111" strokeWidth="1.2" />
        <rect x="188" y="40" width="8" height="30" fill="rgb(15 30 15 / 0.4)" stroke="#111" strokeWidth="1.2" />
        {disc(70, 38, '#e56e56', 'G', true)}
        {disc(58, 74, '#e56e56', 'N')}
        {disc(140, 48, '#5689e5', 'E')}
        {disc(162, 72, '#5689e5', 'A')}
        <circle cx="86" cy="44" r="5.5" fill="#fff" stroke="#111" strokeWidth="1.2" className="motion-safe:animate-pulse" />
        <path d="M 112 30 l 8 6 l -8 6 M 124 30 l 8 6 l -8 6" fill="none" stroke="rgb(255 255 255 / 0.35)" strokeWidth="2" />
      </svg>
    </div>
  );
}

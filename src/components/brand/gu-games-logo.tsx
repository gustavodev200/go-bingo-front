import { cn } from '@/lib/utils';

/** Bolinhas orbitando o "G": cada uma é um jogo do salão (cores das bolas do bingo). */
const ORBIT = [
  { color: '#2563eb', angle: -150 },
  { color: '#db2777', angle: -30 },
  { color: '#16a34a', angle: 90 },
] as const;

/** Marca da plataforma: bola dourada com "G" e três bolinhas orbitando, uma por jogo. Decorativa. */
export function GuGamesMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" aria-hidden className={cn('shrink-0 drop-shadow-[0_0_10px_rgb(251_191_36/0.5)]', className)}>
      <defs>
        <radialGradient id="gu-ball" cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#fef9c3" />
          <stop offset="45%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#b45309" />
        </radialGradient>
      </defs>
      {ORBIT.map(({ color, angle }) => (
        <circle key={color} cx={50 + 39 * Math.cos((angle * Math.PI) / 180)} cy={50 + 39 * Math.sin((angle * Math.PI) / 180)} r="9" fill={color} stroke="#fff" strokeOpacity="0.55" strokeWidth="1.5" />
      ))}
      <circle cx="50" cy="50" r="27" fill="url(#gu-ball)" />
      <circle cx="50" cy="50" r="16" fill="#fff" />
      <text x="50" y="58.5" textAnchor="middle" fontSize="25" fontWeight="800" fill="#4c1d95" fontFamily="var(--font-show), sans-serif">
        G
      </text>
    </svg>
  );
}

/** Marca + nome "GuGames" no dourado do letreiro. */
export function GuGamesLogo({ className }: { className?: string }) {
  return (
    <span className={cn('flex items-center gap-2', className)}>
      <GuGamesMark className="size-10" />
      <span className="font-show text-marquee text-2xl leading-none tracking-wide">GuGames</span>
    </span>
  );
}

import type { CSSProperties, ReactNode } from 'react';
import { CONFETTI_COLORS } from '@/features/game/scene3d/ambience';
import { cn } from '@/lib/utils';
import styles from './stage.module.css';

type Vars = CSSProperties & Record<`--${string}`, string | number>;

/** Cor de cada coluna, igual nas bolas do título, na cartela e no número sorteado. */
export const LETTER_COLORS = { B: '#60a5fa', I: '#f472b6', N: '#fde047', G: '#34d399', O: '#fb923c' } as const;
type Letter = keyof typeof LETTER_COLORS;
const LETTERS = Object.keys(LETTER_COLORS) as Letter[];

const CONFETTI = 16;
const RINGS = [0, 30, 60, 90, 120, 150];
const INNER_BALLS = [
  ['20%', '45%'],
  ['45%', '25%'],
  ['60%', '55%'],
  ['30%', '65%'],
  ['55%', '40%'],
  ['40%', '50%'],
] as const;

/** Fundo fixo do salão (holofotes e chão do palco), no layout raiz. Decorativo. */
export function StageBackdrop() {
  return (
    <div aria-hidden className={`${styles.backdrop} pointer-events-none fixed inset-0 -z-10 overflow-hidden`}>
      <div className={`${styles.beam} ${styles.beamLeft}`} />
      <div className={`${styles.beam} ${styles.beamRight}`} />
      <div className={styles.floor} />
    </div>
  );
}

/** Confete caindo sobre o fundo (tela de entrada). Decorativo. */
export function ConfettiRain() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {Array.from({ length: CONFETTI }, (_, i) => (
          <span
            key={i}
            className={styles.confetti}
            style={
              {
                '--x': `${(i * 37) % 100}%`,
                '--c': CONFETTI_COLORS[i % CONFETTI_COLORS.length],
                '--dur': `${7 + (i % 5) * 1.3}s`,
                '--d': `${-((i * 1.7) % 9)}s`,
              } as Vars
            }
          />
        ))}
    </div>
  );
}

/** Globo-gaiola dourado girando com bolinhas dentro, como o do palco 3D. */
export function MiniGlobe() {
  return (
    <div aria-hidden className="flex flex-col items-center">
      <div className={styles.globeWrap}>
        <div className={styles.innerBalls}>
          {INNER_BALLS.map(([x, y], i) => (
            <span key={i} className={styles.innerBall} style={{ '--x': x, '--y': y, '--d': `${-i * 0.37}s` } as Vars} />
          ))}
        </div>
        <div className={styles.globe}>
          {RINGS.map((r) => (
            <span key={r} className={styles.ring} style={{ '--r': `${r}deg` } as Vars} />
          ))}
          <span className={`${styles.ring} ${styles.equator}`} />
        </div>
      </div>
      <div className={styles.stand} />
    </div>
  );
}

/** Bola de bingo brilhante com a face branca. A cor vem da letra (ou `color`). */
export function BingoBall({ letter, color, bob, delay = 0, className, faceClassName, children }: {
  letter?: Letter;
  color?: string;
  bob?: boolean;
  delay?: number;
  className?: string;
  faceClassName?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(styles.ball, bob && styles.bob, className)}
      style={{ '--c': color ?? (letter ? LETTER_COLORS[letter] : '#fde047'), '--d': `${-delay}s` } as Vars}
    >
      <span className={cn(styles.ballFace, faceClassName)}>{children}</span>
    </span>
  );
}

function BulbRow({ count, offset, reverse }: { count: number; offset: number; reverse?: boolean }) {
  return (
    <span className="flex justify-between px-1">
      {Array.from({ length: count }, (_, j) => (
        <span key={j} className={styles.bulb} style={{ '--i': offset + (reverse ? count - 1 - j : j) } as Vars} />
      ))}
    </span>
  );
}

/** Letreiro "GO BINGO" com lâmpadas correndo em volta e as letras em bolas de bingo. */
export function MarqueeTitle({ compact = false }: { compact?: boolean }) {
  const bulbs = compact ? 10 : 14;
  return (
    <h1 className={cn(styles.sign, 'relative rounded-2xl', compact ? 'px-2 py-1.5' : 'w-full px-3 py-2.5')}>
      <span className="sr-only">Go Bingo</span>
      <span aria-hidden className={cn('flex flex-col', compact ? 'gap-1' : 'gap-2')}>
        <BulbRow count={bulbs} offset={0} />
        {compact ? (
          <span className="flex items-center gap-1 px-1">
            <span className="font-display text-marquee mr-1 text-lg font-bold">GO</span>
            {LETTERS.map((letter, i) => (
              <BingoBall key={letter} letter={letter} bob delay={i * 0.35} className="w-7" faceClassName="text-[11px]">
                {letter}
              </BingoBall>
            ))}
          </span>
        ) : (
          <>
            <span className="font-display text-marquee text-center text-2xl font-bold tracking-[0.5em]">GO</span>
            <span className="grid grid-cols-5 gap-2 px-1">
              {LETTERS.map((letter, i) => (
                <BingoBall key={letter} letter={letter} bob delay={i * 0.35} className="w-full" faceClassName="text-xl sm:text-2xl">
                  {letter}
                </BingoBall>
              ))}
            </span>
          </>
        )}
        <BulbRow count={bulbs} offset={bulbs} reverse />
      </span>
    </h1>
  );
}

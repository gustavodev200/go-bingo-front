import type { CSSProperties } from 'react';
import { CONFETTI_COLORS } from '@/features/game/scene3d/ambience';
import styles from './login-stage.module.css';

type Vars = CSSProperties & Record<`--${string}`, string | number>;

const BINGO = [
  { letter: 'B', color: '#60a5fa' },
  { letter: 'I', color: '#f472b6' },
  { letter: 'N', color: '#fde047' },
  { letter: 'G', color: '#34d399' },
  { letter: 'O', color: '#fb923c' },
] as const;

const BULBS_PER_ROW = 14;
const CONFETTI = 16;
const RINGS = [0, 30, 60, 90, 120, 150];
const INNER_BALLS: [string, string][] = [
  ['20%', '45%'],
  ['45%', '25%'],
  ['60%', '55%'],
  ['30%', '65%'],
  ['55%', '40%'],
  ['40%', '50%'],
];

/** Fundo do salão: holofotes, chão quadriculado do palco e confete. Decorativo. */
export function LoginBackdrop() {
  return (
    <div aria-hidden className={`${styles.backdrop} pointer-events-none fixed inset-0 -z-10 overflow-hidden`}>
      <div className={`${styles.beam} ${styles.beamLeft}`} />
      <div className={`${styles.beam} ${styles.beamRight}`} />
      <div className={styles.floor} />
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

function BulbRow({ offset, reverse }: { offset: number; reverse?: boolean }) {
  return (
    <div className="flex justify-between px-1">
      {Array.from({ length: BULBS_PER_ROW }, (_, j) => (
        <span key={j} className={styles.bulb} style={{ '--i': offset + (reverse ? BULBS_PER_ROW - 1 - j : j) } as Vars} />
      ))}
    </div>
  );
}

/** Letreiro "GO BINGO" com lâmpadas correndo em volta e as letras em bolas de bingo. */
export function MarqueeTitle() {
  return (
    <h1 className={`${styles.sign} relative w-full rounded-2xl px-3 py-2.5`}>
      <span className="sr-only">Go Bingo</span>
      <span aria-hidden className="flex flex-col gap-2">
        <BulbRow offset={0} />
        <span className="bg-linear-to-b from-yellow-100 via-amber-300 to-amber-500 bg-clip-text text-center text-2xl font-black tracking-[0.5em] text-transparent drop-shadow-[0_0_12px_rgb(251_191_36/0.6)]">
          GO
        </span>
        <span className="grid grid-cols-5 gap-2 px-1">
          {BINGO.map(({ letter, color }, i) => (
            <span key={letter} className={styles.ball} style={{ '--c': color, '--d': `${-i * 0.35}s` } as Vars}>
              <span className={`${styles.ballFace} text-xl sm:text-2xl`}>{letter}</span>
            </span>
          ))}
        </span>
        <BulbRow offset={BULBS_PER_ROW} reverse />
      </span>
    </h1>
  );
}

export const arcadeButtonClass = styles.arcade;
export const sceneClass = styles.scene;

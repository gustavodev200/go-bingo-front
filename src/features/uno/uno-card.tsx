import type { CSSProperties } from 'react';
import type { UnoCard, UnoColor } from '@/contracts';
import { cn } from '@/lib/utils';
import { cardLabel } from './rules-view';
import styles from './uno.module.css';

export const COLOR_HEX: Record<UnoColor, string> = { red: '#e5281b', yellow: '#facc15', green: '#16a34a', blue: '#2563eb' };

const SIZES = {
  // min(vw, dvh) keeps cards inside short landscape phones too.
  xs: 'w-[clamp(14px,min(4vw,3.6dvh),24px)]',
  sm: 'w-[clamp(30px,min(9vw,7dvh),52px)]',
  md: 'w-[clamp(46px,min(15vw,12dvh),92px)]',
  lg: 'w-[clamp(52px,min(19vw,15dvh),104px)]',
} as const;

function symbolOf(card: UnoCard): string {
  switch (card.value) {
    case 'skip':
      return '⊘';
    case 'reverse':
      return '⇄';
    case 'draw2':
      return '+2';
    case 'wild4':
      return '+4';
    case 'wild':
      return '';
    default:
      return card.value;
  }
}

/** Four small cards fanned in the middle of a +4, as on the real one. */
function WildFourArt() {
  return (
    <span aria-hidden className="absolute inset-0 flex items-center justify-center">
      {(['green', 'blue', 'red', 'yellow'] as const).map((color, i) => (
        <span
          key={color}
          className="absolute h-[26%] w-[20%] rounded-[12%] ring-1 ring-white"
          style={{ background: COLOR_HEX[color], translate: `${(i - 1.5) * 14}% ${(i % 2) * 10 - 5}%`, rotate: `${(i - 1.5) * 8}deg` }}
        />
      ))}
    </span>
  );
}

/**
 * A 2D UNO card drawn with CSS. `card = null` shows the back. Text scales with
 * the card through container units, so one component serves every size.
 */
export function UnoCardView({ card, size = 'md', dim = false, className, style }: { card: UnoCard | null; size?: keyof typeof SIZES; dim?: boolean; className?: string; style?: CSSProperties }) {
  const base = cn('@container relative aspect-[5/7.6] shrink-0 select-none overflow-hidden rounded-[10%]', SIZES[size], className);
  if (!card) {
    return (
      <span aria-hidden style={style} className={cn(base, styles.back)}>
        <span className={styles.backOval} />
        <span className={cn('font-display absolute inset-0 flex items-center justify-center text-[30cqw] font-black italic', styles.logo)}>UNO</span>
      </span>
    );
  }
  const wild = card.color === 'wild';
  const symbol = symbolOf(card);
  const ink = wild ? '#111' : COLOR_HEX[card.color as UnoColor];
  const long = symbol.length > 1;
  return (
    <span role="img" aria-label={cardLabel(card)} style={{ ...style, background: wild ? '#161616' : ink }} className={cn(base, styles.face, dim && 'opacity-50 saturate-50')}>
      <span className={cn(styles.oval, wild ? styles.wildOval : 'bg-white')} />
      {card.value === 'wild4' && <WildFourArt />}
      {symbol && card.value !== 'wild4' && (
        <span
          className={cn('font-display absolute inset-0 flex items-center justify-center leading-none font-black italic', long ? 'text-[42cqw]' : 'text-[58cqw]')}
          style={{ color: ink, WebkitTextStroke: 'clamp(1px,2cqw,2px) #111', textShadow: '-3cqw 3cqw 0 #111' }}
        >
          {symbol}
        </span>
      )}
      {symbol && (
        <>
          <span className="font-display absolute top-[5%] left-[10%] text-[22cqw] leading-none font-black text-white italic drop-shadow-[0_1px_0_#000]">{symbol}</span>
          <span className="font-display absolute right-[10%] bottom-[5%] rotate-180 text-[22cqw] leading-none font-black text-white italic drop-shadow-[0_1px_0_#000]">{symbol}</span>
        </>
      )}
    </span>
  );
}

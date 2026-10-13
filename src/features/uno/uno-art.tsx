import { UnoCardView } from './uno-card';
import styles from './uno.module.css';

/** UNO card illustration: a fan of cards over the red swirl. Decorative. */
export function UnoArt() {
  return (
    <div aria-hidden className={`relative flex h-full items-center justify-center ${styles.backdrop}`}>
      <div className="flex items-end transition-transform duration-500 group-hover:scale-110 motion-reduce:transition-none">
        <UnoCardView card={{ color: 'red', value: '1' }} size="sm" className="translate-y-3 -rotate-[24deg]" />
        <UnoCardView card={{ color: 'green', value: 'draw2' }} size="sm" className="-ml-3 translate-y-1 -rotate-12" />
        <UnoCardView card={{ color: 'yellow', value: '7' }} size="sm" className="-ml-3" />
        <UnoCardView card={{ color: 'blue', value: 'reverse' }} size="sm" className="-ml-3 translate-y-1 rotate-12" />
        <UnoCardView card={{ color: 'wild', value: 'wild4' }} size="sm" className="-ml-3 translate-y-3 rotate-[24deg]" />
      </div>
      <span className="font-display absolute right-4 bottom-3 -rotate-6 rounded-xl border-2 border-white bg-red-600 px-2 text-lg font-black text-amber-300 italic shadow-lg" style={{ textShadow: '-1px 1px 0 #000' }}>
        UNO!
      </span>
    </div>
  );
}

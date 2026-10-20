import { MiniBall } from './mini-ball';
import styles from './tacada.module.css';

const RACK = [[1], [9, 3], [11, 8, 12], [5, 14, 2, 15]];

/** Tacada illustration: a corner of the felt with the rack and the cue lined up. Decorative. */
export function TacadaArt() {
  return (
    <div aria-hidden className={`relative flex h-full items-center justify-center overflow-hidden ${styles.backdrop}`}>
      <div className="relative h-24 w-40 -rotate-6 rounded-xl border-[6px] border-[#4a2410] bg-[radial-gradient(circle,#17a578,#0a6249)] shadow-[0_14px_30px_rgb(0_0_0/0.5)] transition-transform duration-500 group-hover:scale-110 motion-reduce:transition-none">
        <span className="absolute -top-1.5 -left-1.5 size-3 rounded-full bg-black" />
        <span className="absolute -top-1.5 left-1/2 size-3 -translate-x-1/2 rounded-full bg-black" />
        <span className="absolute -top-1.5 -right-1.5 size-3 rounded-full bg-black" />
        <span className="absolute -bottom-1.5 -left-1.5 size-3 rounded-full bg-black" />
        <span className="absolute -bottom-1.5 left-1/2 size-3 -translate-x-1/2 rounded-full bg-black" />
        <span className="absolute -right-1.5 -bottom-1.5 size-3 rounded-full bg-black" />
        <div className="absolute top-1/2 right-4 flex -translate-y-1/2 items-center gap-px">
          {RACK.map((col, i) => (
            <div key={i} className="flex flex-col gap-px">
              {col.map((n) => (
                <MiniBall key={n} n={n} className="size-3" />
              ))}
            </div>
          ))}
        </div>
        <MiniBall n={0} className="absolute top-1/2 left-6 size-3 -translate-y-1/2" />
        <span className="absolute top-1/2 -left-24 h-1 w-28 -translate-y-1/2 rounded-full bg-[linear-gradient(90deg,#1c0b04,#7c2d12_40%,#e7c48f_45%,#f5e6c8_96%,#2563eb_96%)] shadow" />
      </div>
      <span className="font-display absolute right-4 bottom-3 -rotate-6 rounded-xl border-2 border-white bg-emerald-800 px-2 text-lg font-black text-amber-200 shadow-lg">TACADA!</span>
    </div>
  );
}

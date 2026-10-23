import type { CSSProperties } from 'react';
import type { AvatarLook, MouthStyle } from '@/features/game/scene3d/avatar-look';
import { lookFor } from '@/features/game/scene3d/characters';
import type { Jersey } from '@/features/game/scene3d/jerseys';
import { cn } from '@/lib/utils';

const shade = (color: string, light = 30, dark = 30) =>
  `radial-gradient(circle at 35% 30%, color-mix(in oklch, ${color}, white ${light}%), ${color} 55%, color-mix(in oklch, ${color}, black ${dark}%))`;

/** Mesmo padrão da camisa 3D, em gradientes CSS (vista de frente). */
export function jerseyBackground(j: Jersey): string {
  const [p, s, a] = [j.primary, j.secondary, j.accent];
  const n = j.stripes ?? 6;
  const step = 100 / n;
  switch (j.pattern) {
    case 'stripes':
      return `repeating-linear-gradient(90deg, ${p} 0 ${step / 2}%, ${s} ${step / 2}% ${step}%)`;
    case 'hoops':
      return `repeating-linear-gradient(180deg, ${p} 0 ${step}%, ${s} ${step}% ${step * 2}%)`;
    case 'sash':
      return `linear-gradient(225deg, ${p} 38%, ${s} 38% 56%, ${p} 56%)`;
    case 'halves':
      return `linear-gradient(90deg, ${p} 50%, ${s} 50%)`;
    case 'tricolor':
      return `repeating-linear-gradient(90deg, ${p} 0 ${step * 0.42}%, ${a} ${step * 0.42}% ${step * 0.5}%, ${s} ${step * 0.5}% ${step * 0.92}%, ${a} ${step * 0.92}% ${step}%)`;
    case 'bands':
      return `linear-gradient(180deg, ${p} 30%, ${s} 30% 42%, ${a} 42% 54%, ${p} 54%)`;
    case 'chevron':
      return `linear-gradient(135deg, transparent 46%, ${s} 46% 56%, transparent 56%) left / 50% 100% no-repeat, linear-gradient(225deg, transparent 46%, ${s} 46% 56%, transparent 56%) right / 50% 100% no-repeat, ${p}`;
    case 'star':
      return `radial-gradient(circle at 50% 42%, ${s} 0 18%, transparent 19%), ${p}`;
    case 'diamond':
      return `radial-gradient(circle at 50% 44%, ${a} 0 10%, ${s} 10% 22%, transparent 23%), ${p}`;
    case 'pinstripes':
      return `repeating-linear-gradient(90deg, ${p} 0 ${step * 0.88}%, ${s} ${step * 0.88}% ${step}%)`;
    default:
      return p;
  }
}

const MOUTH: Record<MouthStyle, string> = {
  grin: 'h-[12%] w-[34%] rounded-b-full border-t-[3px] border-white bg-red-900',
  smile: 'h-[8%] w-[28%] rounded-b-full border-b-2 border-red-900',
  buck: 'h-[8%] w-[28%] rounded-b-full border-b-2 border-red-900 after:absolute after:top-full after:left-1/2 after:h-[140%] after:w-[44%] after:-translate-x-1/2 after:rounded-b-sm after:bg-white',
  gap: 'h-[12%] w-[34%] rounded-b-full border-t-[3px] border-white bg-red-900 after:absolute after:top-[-3px] after:left-1/2 after:h-[3px] after:w-[34%] after:-translate-x-1/2 after:bg-red-900',
  tongue: 'h-[8%] w-[28%] rounded-b-full border-b-2 border-red-900 after:absolute after:top-full after:left-[55%] after:h-[150%] after:w-[34%] after:rounded-b-full after:bg-rose-400',
  o: 'h-[13%] w-[13%] rounded-full bg-red-900',
  smirk: 'h-[8%] w-[22%] translate-x-[20%] rounded-br-full border-b-2 border-red-900',
  wavy: 'h-[6%] w-[30%] [background:repeating-linear-gradient(135deg,#7f1d1d_0_2px,transparent_2px_5px)]',
  braces: 'h-[12%] w-[34%] rounded-b-full border-t-[3px] border-slate-300 bg-red-900',
};

/** Jogador em CSS: mesmo rosto, cabelo, camisa e chuteira do boneco 3D (escolhido ou derivado do id). Decorativo. */
export function Avatar({
  id,
  character,
  look,
  host = false,
  className,
}: {
  id?: string;
  character?: string | null;
  look?: AvatarLook;
  host?: boolean;
  className?: string;
}) {
  const { face: f, jersey: j } = look ?? lookFor(id ?? '', character);
  const skin = { background: shade(f.skin, 22, 18) } as CSSProperties;
  const hair = { background: shade(f.hair, 18, 30) } as CSSProperties;
  const pupil = (side: -1 | 1) => (f.eyes === 'cross' ? -side * 22 : f.eyes === 'side' ? 22 : 0);
  const eye = f.eyes === 'big' ? 'size-[17%]' : f.eyes === 'tiny' ? 'size-[10%]' : 'size-[13%]';
  const brow = f.brows === 'angry' ? 14 : f.brows === 'worried' ? -14 : 0;
  return (
    <span aria-hidden className={cn('relative inline-block aspect-5/6 w-10 shrink-0', className)}>
      {/* cabelo atrás da cabeça (black power, longo, coque) */}
      {f.hairStyle === 'afro' && <span className="absolute top-[-6%] left-1/2 h-[64%] w-[100%] -translate-x-1/2 rounded-full" style={hair} />}
      {f.hairStyle === 'long' && <span className="absolute top-[8%] left-1/2 h-[62%] w-[84%] -translate-x-1/2 rounded-[30%]" style={hair} />}
      {f.hairStyle === 'bun' && <span className="absolute top-[-6%] left-1/2 size-[28%] -translate-x-1/2 rounded-full" style={hair} />}
      {/* camisa com o padrão do time + gola */}
      <span
        className="absolute bottom-0 left-1/2 h-[34%] w-[58%] -translate-x-1/2 overflow-hidden rounded-t-[40%] rounded-b-[18%] shadow-[inset_0_-3px_4px_rgb(0_0_0/0.25)]"
        style={{ background: jerseyBackground(j) }}
      >
        <span className="absolute top-0 left-1/2 h-[24%] w-[34%] -translate-x-1/2 rounded-b-full" style={{ background: j.collar }} />
      </span>
      {/* cabeça "cubo arredondado" */}
      <span className="absolute top-[4%] left-1/2 h-[62%] w-[76%] -translate-x-1/2 overflow-hidden rounded-[30%]" style={skin}>
        {f.hairStyle !== 'afro' && f.hairStyle !== 'bald' && (
          <span
            className={cn('absolute top-[-6%]', f.hairStyle === 'mohawk' ? 'left-[38%] h-[30%] w-[24%]' : 'left-[-4%] h-[36%] w-[108%] rounded-b-[30%]')}
            style={f.hairStyle === 'spiky' || f.hairStyle === 'quiff' || f.hairStyle === 'short' ? { ...hair, clipPath: 'polygon(0 0,100% 0,100% 100%,85% 70%,70% 100%,55% 70%,40% 100%,25% 70%,10% 100%,0 75%)' } : hair}
          />
        )}
        {f.extras.includes('headband') && <span className="absolute top-[22%] left-0 h-[9%] w-full" style={{ background: j.secondary }} />}
        {f.extras.includes('beard') && <span className="absolute bottom-[-4%] left-[-4%] h-[34%] w-[108%] rounded-t-[50%]" style={hair} />}
        {/* olhos (zarolho/desconfiado mexem a pupila; piscadinha fecha um) */}
        {([-1, 1] as const).map((side) => (
          <span key={side} className={cn('absolute top-[46%] flex -translate-x-1/2 items-center justify-center overflow-hidden rounded-full bg-white', eye)} style={{ left: `${50 + side * 17}%` }}>
            {f.eyes === 'wink' && side > 0 ? (
              <span className="absolute inset-0" style={{ ...skin, borderBottom: '2px solid #1e1b4b' }} />
            ) : (
              <span className="size-[62%] rounded-full bg-slate-950" style={{ transform: `translateX(${pupil(side)}%)` }} />
            )}
            {f.eyes === 'sleepy' && <span className="absolute inset-x-0 top-0 h-1/2" style={skin} />}
          </span>
        ))}
        {/* sobrancelhas */}
        {f.brows === 'uni' ? (
          <span className="absolute top-[38%] left-1/2 h-[6%] w-[52%] -translate-x-1/2 rounded-full" style={{ background: f.hair }} />
        ) : (
          ([-1, 1] as const).map((side) => (
            <span
              key={side}
              className={cn('absolute top-[38%] w-[20%] -translate-x-1/2 rounded-full', f.brows === 'thick' ? 'h-[7%]' : 'h-[4%]')}
              style={{ left: `${50 + side * 17}%`, background: f.hair, transform: `translateY(${f.brows === 'raised' && side > 0 ? -60 : 0}%) rotate(${side * brow}deg)` }}
            />
          ))
        )}
        {f.extras.includes('glasses') &&
          ([-1, 1] as const).map((side) => <span key={side} className="absolute top-[42%] size-[22%] -translate-x-1/2 rounded-full border-2 border-slate-900" style={{ left: `${50 + side * 17}%` }} />)}
        {f.extras.includes('freckles') && <span className="absolute top-[62%] left-[14%] h-[6%] w-[72%] [background:radial-gradient(circle,#8b4513_30%,transparent_35%)_0_0/16%_100%_repeat-x]" />}
        {f.extras.includes('bandage') && <span className="absolute top-[62%] right-[10%] h-[7%] w-[20%] rotate-45 bg-amber-100" />}
        <span className="absolute top-[64%] left-[10%] size-[14%] rounded-full bg-rose-400/40" />
        <span className="absolute top-[64%] right-[10%] size-[14%] rounded-full bg-rose-400/40" />
        {f.extras.includes('bigNose') && <span className="absolute top-[56%] left-1/2 size-[18%] -translate-x-1/2 rounded-full" style={skin} />}
        <span className={cn('absolute top-[74%] left-1/2 -translate-x-1/2', MOUTH[f.mouth])} />
        {f.extras.includes('mustache') && <span className="absolute top-[66%] left-1/2 h-[10%] w-[46%] -translate-x-1/2 rounded-b-full" style={{ background: f.hair }} />}
      </span>
      {host && (
        <span
          className="absolute top-[-8%] left-1/2 h-[22%] w-[44%] -translate-x-1/2 bg-linear-to-b from-yellow-200 to-amber-500"
          style={{ clipPath: 'polygon(0 100%, 0 20%, 25% 55%, 50% 0, 75% 55%, 100% 20%, 100% 100%)' }}
        />
      )}
    </span>
  );
}

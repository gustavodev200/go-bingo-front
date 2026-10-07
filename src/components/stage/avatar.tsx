import type { CSSProperties } from 'react';
import { avatarFromId, type AvatarLook } from '@/features/game/scene3d/avatar-look';
import { cn } from '@/lib/utils';

const MOUTH: Record<AvatarLook['face'], string> = {
  smile: 'h-[9%] w-[26%] rounded-b-full border-b-2 border-red-900',
  grin: 'h-[11%] w-[36%] rounded-b-full bg-red-900',
  wow: 'h-[12%] w-[12%] rounded-full bg-red-900',
};

const shade = (color: string, light = 35, dark = 35) =>
  `radial-gradient(circle at 35% 30%, color-mix(in oklch, ${color}, white ${light}%), ${color} 55%, color-mix(in oklch, ${color}, black ${dark}%))`;

function Hat({ look, host }: { look: AvatarLook; host: boolean }) {
  if (host) {
    return (
      <span
        className="absolute top-[-8%] left-1/2 h-[22%] w-[44%] -translate-x-1/2 bg-linear-to-b from-yellow-200 to-amber-500"
        style={{ clipPath: 'polygon(0 100%, 0 20%, 25% 55%, 50% 0, 75% 55%, 100% 20%, 100% 100%)' }}
      />
    );
  }
  const color = { background: shade(look.accent, 25, 25) };
  switch (look.hat) {
    case 'tophat':
      return <span className="absolute top-[-16%] left-1/2 h-[28%] w-[34%] -translate-x-1/2 rounded-t-sm" style={color} />;
    case 'cap':
      return <span className="absolute top-[-1%] left-[18%] h-[16%] w-[66%] rounded-t-full" style={color} />;
    case 'beanie':
      return <span className="absolute top-[-3%] left-1/2 h-[22%] w-[66%] -translate-x-1/2 rounded-t-full" style={color} />;
    case 'party':
      return <span className="absolute top-[-20%] left-1/2 h-[28%] w-[24%] -translate-x-1/2" style={{ ...color, clipPath: 'polygon(50% 0, 100% 100%, 0 100%)' }} />;
    default:
      return null;
  }
}

/** Boneco chibi em CSS: mesma pele, cabelo, roupa, chapéu e rosto do avatar 3D (derivados do id). Decorativo. */
export function Avatar({ id, look, host = false, className }: { id?: string; look?: AvatarLook; host?: boolean; className?: string }) {
  const l = look ?? avatarFromId(id ?? '');
  const skin = { background: shade(l.skin, 25, 20) } as CSSProperties;
  const hair = { background: shade(l.hair, 20, 30) } as CSSProperties;
  return (
    <span aria-hidden className={cn('relative inline-block aspect-5/6 w-10 shrink-0', className)}>
      {/* cabelo atrás da cabeça (black power, longo) */}
      {l.hairStyle === 'afro' && <span className="absolute top-[-6%] left-1/2 h-[66%] w-[96%] -translate-x-1/2 rounded-full" style={hair} />}
      {l.hairStyle === 'long' && <span className="absolute top-[10%] left-1/2 h-[64%] w-[84%] -translate-x-1/2 rounded-t-full rounded-b-[30%]" style={hair} />}
      {l.hairStyle === 'bun' && <span className="absolute top-[-4%] left-1/2 size-[30%] -translate-x-1/2 rounded-full" style={hair} />}
      {/* corpo (camisa) */}
      <span className="absolute bottom-0 left-1/2 h-[34%] w-[52%] -translate-x-1/2 rounded-t-[45%] rounded-b-[25%]" style={{ background: shade(l.body) }} />
      {/* cabeça */}
      <span className="absolute top-[4%] left-1/2 h-[64%] w-[74%] -translate-x-1/2 overflow-hidden rounded-full" style={skin}>
        {l.hairStyle !== 'afro' && (
          <span
            className="absolute top-[-6%] left-[-4%] h-[44%] w-[108%] rounded-b-[40%]"
            style={l.hairStyle === 'spiky' ? { ...hair, clipPath: 'polygon(0 0,100% 0,100% 100%,85% 70%,70% 100%,55% 70%,40% 100%,25% 70%,10% 100%,0 75%)' } : hair}
          />
        )}
        <span className="absolute top-[50%] left-[28%] h-[14%] w-[11%] rounded-full bg-slate-900" />
        <span className="absolute top-[50%] right-[28%] h-[14%] w-[11%] rounded-full bg-slate-900" />
        <span className="absolute top-[64%] left-[12%] size-[14%] rounded-full bg-rose-400/50" />
        <span className="absolute top-[64%] right-[12%] size-[14%] rounded-full bg-rose-400/50" />
        <span className={cn('absolute top-[70%] left-1/2 -translate-x-1/2', MOUTH[l.face])} />
      </span>
      <Hat look={l} host={host} />
    </span>
  );
}

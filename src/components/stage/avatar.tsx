import type { CSSProperties } from 'react';
import { avatarFromId, type AvatarLook } from '@/features/game/scene3d/avatar-look';
import { cn } from '@/lib/utils';

const MOUTH: Record<AvatarLook['face'], string> = {
  smile: 'h-[8%] w-[30%] rounded-b-full',
  grin: 'h-[11%] w-[44%] rounded-b-full',
  wow: 'h-[16%] w-[16%] rounded-full',
};

function Hat({ look, host }: { look: AvatarLook; host: boolean }) {
  if (host) {
    return (
      <span
        className="absolute top-[-6%] left-1/2 h-[24%] w-[46%] -translate-x-1/2 bg-linear-to-b from-yellow-200 to-amber-500"
        style={{ clipPath: 'polygon(0 100%, 0 20%, 25% 55%, 50% 0, 75% 55%, 100% 20%, 100% 100%)' }}
      />
    );
  }
  const color = { background: look.accent };
  switch (look.hat) {
    case 'tophat':
      return <span className="absolute top-[-14%] left-1/2 h-[30%] w-[34%] -translate-x-1/2 rounded-t-sm" style={color} />;
    case 'cap':
      return <span className="absolute top-[2%] left-[22%] h-[16%] w-[62%] rounded-t-full" style={color} />;
    case 'beanie':
      return <span className="absolute top-[0%] left-1/2 h-[22%] w-[54%] -translate-x-1/2 rounded-t-full" style={color} />;
    case 'party':
      return <span className="absolute top-[-18%] left-1/2 h-[30%] w-[26%] -translate-x-1/2" style={{ ...color, clipPath: 'polygon(50% 0, 100% 100%, 0 100%)' }} />;
    default:
      return null;
  }
}

/** Boneco de vinil em CSS: mesma cor, chapéu e rosto do avatar 3D (derivados do id). Decorativo. */
export function Avatar({ id, look, host = false, className }: { id?: string; look?: AvatarLook; host?: boolean; className?: string }) {
  const l = look ?? avatarFromId(id ?? '');
  const body = { background: `radial-gradient(circle at 35% 30%, color-mix(in oklch, ${l.body}, white 35%), ${l.body} 55%, color-mix(in oklch, ${l.body}, black 35%))` } as CSSProperties;
  return (
    <span aria-hidden className={cn('relative inline-block aspect-[5/6] w-10 shrink-0', className)}>
      <span className="absolute bottom-0 left-1/2 h-[46%] w-[62%] -translate-x-1/2 rounded-t-[45%] rounded-b-[30%]" style={body} />
      <span className="absolute top-[8%] left-1/2 h-[52%] w-[60%] -translate-x-1/2 rounded-full" style={body}>
        <span className="absolute top-[42%] left-[28%] size-[13%] rounded-full bg-slate-900" />
        <span className="absolute top-[42%] right-[28%] size-[13%] rounded-full bg-slate-900" />
        <span className={cn('absolute top-[66%] left-1/2 -translate-x-1/2 bg-red-900', MOUTH[l.face])} />
      </span>
      <Hat look={l} host={host} />
    </span>
  );
}

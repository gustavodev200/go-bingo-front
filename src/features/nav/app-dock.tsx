'use client';

import { Home, Plus, Trophy, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BingoBall } from '@/components/stage/stage';
import { cn } from '@/lib/utils';

/** Telas com o dock; dentro da sala (/CODIGO) a tela é do jogo e ele some. */
const DOCK_PATHS = new Set(['/', '/create', '/ranking']);

/** Toque curtinho no Android (iOS ignora `vibrate`). */
function tick() {
  navigator.vibrate?.(8);
}

function Tab({ href, label, icon: Icon, active }: { href: string; label: string; icon: LucideIcon; active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      onClick={tick}
      className={cn('group flex min-h-14 flex-1 flex-col items-center justify-center gap-1 text-[11px] font-semibold tracking-wide transition-colors', active ? 'text-amber-200' : 'text-violet-200/70 active:text-white')}
    >
      {/* lâmpada do letreiro: acesa na aba atual */}
      <span aria-hidden className={cn('size-1.5 rounded-full transition-all duration-300', active ? 'bg-amber-200 shadow-[0_0_10px_2px_rgb(251_191_36/0.8)]' : 'bg-violet-300/20')} />
      <Icon aria-hidden className={cn('size-6 transition-transform duration-300 group-active:scale-90', active && 'scale-110 drop-shadow-[0_0_8px_rgb(251_191_36/0.7)]')} />
      {label}
    </Link>
  );
}

/** Barra de navegação do celular/PWA: Início · bola "Criar sala" no centro · Ranking. */
export function AppDock() {
  const pathname = usePathname();
  if (!DOCK_PATHS.has(pathname)) return null;
  const creating = pathname === '/create';

  return (
    <>
      {/* reserva o espaço do dock no fim da página para nada ficar escondido atrás dele */}
      <div aria-hidden className="h-[calc(5.5rem+env(safe-area-inset-bottom))] md:hidden" />
      <nav aria-label="Navegação" className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:hidden">
        <div className="relative mx-auto flex max-w-md items-end rounded-3xl border border-amber-300/30 bg-violet-950/75 px-2 shadow-[0_-8px_40px_-12px_rgb(245_158_11/0.45),inset_0_1px_0_rgb(255_255_255/0.08)] backdrop-blur-xl">
          <Tab href="/" label="Início" icon={Home} active={pathname === '/'} />
          <Link href="/create" aria-label="Criar sala" aria-current={creating ? 'page' : undefined} onClick={tick} className="group relative -mt-7 flex w-24 flex-col items-center gap-1 pb-2 text-[11px] font-semibold tracking-wide text-amber-200">
            {/* halo girando atrás da bola, como os holofotes do palco */}
            <span aria-hidden className="absolute top-0 size-17 rounded-full bg-[conic-gradient(from_0deg,#f472b6,#fde047,#60a5fa,#34d399,#fb923c,#f472b6)] opacity-70 blur-md motion-safe:animate-[spin_6s_linear_infinite]" />
            <BingoBall color="#f59e0b" bob={!creating} className={cn('relative w-16 ring-4 ring-violet-950 transition-transform duration-200 group-active:scale-90', creating && 'scale-105')} faceClassName="text-violet-950">
              <Plus aria-hidden className="size-7" strokeWidth={3} />
            </BingoBall>
            <span aria-hidden>Criar sala</span>
          </Link>
          <Tab href="/ranking" label="Ranking" icon={Trophy} active={pathname === '/ranking'} />
        </div>
      </nav>
    </>
  );
}

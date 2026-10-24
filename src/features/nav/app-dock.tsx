'use client';

import { Home, Trophy, User, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

/** Telas com o dock; dentro da sala (/CODIGO) a tela é do jogo e ele some. */
const DOCK_PATHS = new Set(['/', '/bingo', '/create', '/ranking', '/perfil', '/truco', '/truco/sinais', '/uno', '/bomber', '/botao', '/snake', '/infiltrado', '/damas', '/tacada', '/blackjack']);

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

/** Barra de navegação do celular/PWA: Início · Ranking geral · Perfil. Criar sala fica dentro de cada jogo. */
export function AppDock() {
  const pathname = usePathname();
  if (!DOCK_PATHS.has(pathname)) return null;

  return (
    <>
      {/* reserva o espaço do dock no fim da página para nada ficar escondido atrás dele */}
      <div aria-hidden className="h-[calc(5.5rem+env(safe-area-inset-bottom))] md:hidden" />
      <nav aria-label="Navegação" className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:hidden">
        <div className="relative mx-auto flex max-w-md items-end rounded-3xl border border-amber-300/30 bg-violet-950/75 px-2 shadow-[0_-8px_40px_-12px_rgb(245_158_11/0.45),inset_0_1px_0_rgb(255_255_255/0.08)] backdrop-blur-xl">
          <Tab href="/" label="Início" icon={Home} active={pathname === '/'} />
          <Tab href="/ranking" label="Ranking" icon={Trophy} active={pathname === '/ranking'} />
          <Tab href="/perfil" label="Perfil" icon={User} active={pathname === '/perfil'} />
        </div>
      </nav>
    </>
  );
}

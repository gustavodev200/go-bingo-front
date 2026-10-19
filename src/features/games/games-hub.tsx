'use client';

import { LogOut } from 'lucide-react';
import { DedeGamesLogo } from '@/components/brand/dede-games-logo';
import { Button } from '@/components/ui/button';
import { useLogout } from '@/features/auth/use-logout';
import { useProfile } from '@/features/profile/profile-context';
import { ProfilePill } from '@/features/profile/profile-pill';
import { GAMES } from './catalog';
import { GameCard } from './game-card';

/** Platform entry: greets the player and lists every game from the catalog. */
export function GamesHub() {
  const { profile } = useProfile();
  const logout = useLogout();

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 pt-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] md:max-w-3xl lg:max-w-5xl">
      <header className="flex items-center justify-between gap-3">
        <DedeGamesLogo className="shrink-0" />
        <ProfilePill />
      </header>

      <section className="animate-in fade-in slide-in-from-bottom-2 flex flex-wrap items-end justify-between gap-x-4 gap-y-1 duration-500 motion-reduce:animate-none">
        <div className="flex min-w-0 flex-col">
          <p className="truncate text-xs font-semibold tracking-[0.25em] text-pink-300 uppercase">Bem-vindo, {profile.nickname}</p>
          <h1 className="font-display text-marquee text-2xl font-bold sm:text-3xl">Escolha seu jogo</h1>
        </div>
        <p className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-violet-100">
          <span aria-hidden className="size-2 rounded-full bg-emerald-400" />
          {GAMES.length} jogos no salão
        </p>
      </section>

      <section aria-label="Jogos" className="flex flex-col gap-3">
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {GAMES.map((game, i) => (
            <li key={game.id} className="animate-in fade-in slide-in-from-bottom-4 fill-mode-both duration-500 motion-reduce:animate-none" style={{ animationDelay: `${120 + i * 80}ms` }}>
              <GameCard game={game} />
            </li>
          ))}
          <li aria-hidden className="hidden min-h-48 items-center justify-center rounded-3xl border-2 border-dashed border-white/10 p-6 text-center text-sm font-semibold text-violet-200/50 sm:flex">
            Novos jogos chegando ao salão
          </li>
        </ul>
      </section>

      <nav className="flex justify-end text-sm">
        <Button variant="ghost" className="h-11 gap-2 rounded-xl text-violet-200" onClick={() => void logout()}>
          <LogOut aria-hidden />
          Sair
        </Button>
      </nav>
    </main>
  );
}

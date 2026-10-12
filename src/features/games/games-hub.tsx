'use client';

import { LogOut, Sparkles } from 'lucide-react';
import { GuGamesLogo } from '@/components/brand/gu-games-logo';
import { Avatar } from '@/components/stage/avatar';
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
        <GuGamesLogo className="shrink-0" />
        <ProfilePill />
      </header>

      <section className="glass animate-in fade-in slide-in-from-bottom-2 relative flex items-center gap-4 overflow-hidden p-5 duration-500 motion-reduce:animate-none sm:gap-6 sm:p-7">
        {/* spotlight behind the player's character */}
        <span aria-hidden className="absolute -top-16 -left-10 size-56 rounded-full bg-amber-300/20 blur-3xl" />
        <Avatar id={profile.id} character={profile.character} className="relative w-20 shrink-0 sm:w-28" />
        <div className="relative flex min-w-0 flex-col gap-1.5">
          <p className="truncate text-xs font-semibold tracking-[0.25em] text-pink-300 uppercase">Bem-vindo, {profile.nickname}</p>
          <h1 className="font-display text-marquee text-3xl font-bold sm:text-4xl">Escolha seu jogo</h1>
          <p className="text-muted-foreground text-sm sm:text-base">Um salão, vários jogos. Escolha uma mesa, chame a galera e boa sorte!</p>
        </div>
      </section>

      <section aria-labelledby="games-title" className="flex flex-col gap-3">
        <h2 id="games-title" className="font-display flex items-center gap-2 text-lg font-semibold">
          <Sparkles aria-hidden className="size-5 text-amber-300" />
          Jogos
        </h2>
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

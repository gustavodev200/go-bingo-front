'use client';

import { ChevronLeft, LogOut } from 'lucide-react';
import Link from 'next/link';
import { Coins } from '@/components/stage/coin';
import { Button } from '@/components/ui/button';
import { UpgradeButton } from '@/features/auth/upgrade-button';
import { useLogout } from '@/features/auth/use-logout';
import { useProfile } from '@/features/profile/profile-context';
import { CharacterEditor } from './character-editor';
import { CoinHistory } from './coin-history';
import { NicknameEditor } from './nickname-editor';
import { StatsGrid } from './stats-grid';
import { useProfileStats } from './use-profile-stats';

export function ProfileView() {
  const { profile, refresh } = useProfile();
  const { state, stats, reload } = useProfileStats();
  const logout = useLogout();

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 pt-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
      {/* no celular o dock faz esse papel */}
      <Link href="/" className="hidden min-h-11 items-center gap-1 self-start text-sm text-violet-200 hover:text-white md:flex">
        <ChevronLeft aria-hidden className="size-4" />
        Voltar
      </Link>
      <h1 className="sr-only">Seu perfil</h1>
      <section className="glass flex flex-col items-center gap-2 p-5 text-center" aria-label="Identidade">
        <CharacterEditor saved={profile.character ?? null} onSaved={refresh} />
        <NicknameEditor nickname={profile.nickname ?? ''} onSaved={refresh} />
        <p className="flex items-center gap-2 text-sm">
          <Coins amount={profile.coins} className="rounded-full bg-amber-300/15 px-2.5 py-1 text-amber-200 ring-1 ring-amber-300/30" />
          <span className="text-violet-200/70">{profile.isGuest ? 'convidado' : 'conta Google'}</span>
        </p>
      </section>

      {profile.isGuest && <UpgradeButton />}

      <section className="flex flex-col gap-3" aria-label="Estatísticas">
        <h2 className="font-display text-lg font-semibold">Estatísticas</h2>
        {state === 'loading' && (
          <p className="text-muted-foreground text-sm" aria-busy="true">
            Carregando estatísticas…
          </p>
        )}
        {state === 'error' && (
          <div role="alert" className="glass flex flex-col items-center gap-2 p-4 text-sm">
            Não foi possível carregar suas estatísticas.
            <Button variant="outline" className="h-11 rounded-xl" onClick={reload}>
              Tentar de novo
            </Button>
          </div>
        )}
        {stats && <StatsGrid stats={stats} isGuest={profile.isGuest} />}
      </section>

      {stats && (
        <section className="flex flex-col gap-3" aria-label="Moedas">
          <h2 className="font-display text-lg font-semibold">Últimas moedas</h2>
          <CoinHistory entries={stats.coinHistory} />
        </section>
      )}

      <Button variant="ghost" className="h-11 gap-2 self-center rounded-xl text-violet-200" onClick={() => void logout()} aria-label="Sair da conta">
        <LogOut aria-hidden />
        Sair
      </Button>
    </main>
  );
}

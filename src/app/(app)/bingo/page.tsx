'use client';

import { ChevronLeft, LogOut, Trophy } from 'lucide-react';
import Link from 'next/link';
import { MarqueeTitle } from '@/components/stage/stage';
import { Button } from '@/components/ui/button';
import { UpgradeButton } from '@/features/auth/upgrade-button';
import { useLogout } from '@/features/auth/use-logout';
import { useProfile } from '@/features/profile/profile-context';
import { ProfilePill } from '@/features/profile/profile-pill';
import { InstallBanner } from '@/features/pwa/install-banner';
import { JoinByCodeForm } from '@/features/rooms/join-by-code-form';
import { PublicRooms } from '@/features/rooms/public-rooms';

export default function BingoLobbyPage() {
  const { profile } = useProfile();
  const logout = useLogout();

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 pt-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
      {/* on mobile the dock does this */}
      <Link href="/" className="hidden min-h-11 items-center gap-1 self-start text-sm text-violet-200 hover:text-white md:flex">
        <ChevronLeft aria-hidden className="size-4" />
        Jogos
      </Link>
      <header className="flex items-center justify-between gap-3">
        <div className="shrink-0">
          <MarqueeTitle compact />
        </div>
        <ProfilePill />
      </header>

      {profile.isGuest && <UpgradeButton />}
      <InstallBanner />

      <section className="glass flex flex-col gap-4 p-5" aria-label="Jogar">
        <h2 className="font-display text-marquee text-2xl font-bold">Bora jogar?</h2>
        <JoinByCodeForm />
        <div aria-hidden className="flex items-center gap-3 text-xs font-semibold tracking-widest text-violet-200/60 uppercase">
          <span className="h-px flex-1 bg-white/15" />
          ou
          <span className="h-px flex-1 bg-white/15" />
        </div>
        <Button asChild size="lg" className="h-12 rounded-xl text-base">
          <Link href="/create">Criar sala</Link>
        </Button>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-display flex items-center gap-2 text-lg font-semibold">
          <span aria-hidden className="relative flex size-2.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-pink-400 opacity-75 motion-reduce:animate-none" />
            <span className="relative inline-flex size-2.5 rounded-full bg-pink-500" />
          </span>
          Salas públicas
        </h2>
        <PublicRooms />
      </section>

      <nav className="flex justify-end gap-3 text-sm md:justify-between">
        <Button asChild variant="outline" className="hidden h-11 flex-1 gap-2 rounded-xl md:inline-flex">
          <Link href="/ranking">
            <Trophy aria-hidden className="text-amber-300" />
            Ranking
          </Link>
        </Button>
        <Button variant="ghost" className="h-11 gap-2 rounded-xl text-violet-200" onClick={() => void logout()}>
          <LogOut aria-hidden />
          Sair
        </Button>
      </nav>
    </main>
  );
}

'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { UpgradeButton } from '@/features/auth/upgrade-button';
import { useProfile } from '@/features/profile/profile-context';
import { InstallBanner } from '@/features/pwa/install-banner';
import { JoinByCodeForm } from '@/features/rooms/join-by-code-form';
import { PublicRooms } from '@/features/rooms/public-rooms';
import { createClient } from '@/lib/supabase/client';

export default function HomePage() {
  const { profile } = useProfile();
  const router = useRouter();

  async function logout() {
    await createClient().auth.signOut();
    router.replace('/login');
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 pt-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Go Bingo</h1>
        <span className="text-sm">
          {profile.nickname} {profile.isGuest ? '(convidado)' : `· ${profile.points} pts`}
        </span>
      </header>
      {profile.isGuest && <UpgradeButton />}
      <InstallBanner />
      <JoinByCodeForm />
      <Button asChild size="lg" className="h-11">
        <Link href="/create">Criar sala</Link>
      </Button>
      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">Salas públicas</h2>
        <PublicRooms />
      </section>
      <nav className="flex justify-between text-sm">
        <Link href="/ranking" className="flex min-h-11 items-center underline">
          Ranking
        </Link>
        <button onClick={() => void logout()} className="min-h-11 underline">
          Sair
        </button>
      </nav>
    </main>
  );
}

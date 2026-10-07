'use client';

import { ChevronLeft, Trophy } from 'lucide-react';
import Link from 'next/link';
import { useProfile } from '@/features/profile/profile-context';
import { RankingList } from '@/features/ranking/ranking-list';

export default function RankingPage() {
  const { profile } = useProfile();
  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 py-5">
      {/* no celular o dock faz esse papel */}
      <Link href="/" className="hidden min-h-11 items-center gap-1 self-start md:flex text-sm text-violet-200 hover:text-white">
        <ChevronLeft aria-hidden className="size-4" />
        Voltar
      </Link>
      <header className="flex flex-col items-center gap-2 text-center">
        <Trophy aria-hidden className="size-14 text-amber-300 drop-shadow-[0_0_18px_rgb(251_191_36/0.7)]" />
        <h1 className="font-display text-marquee text-3xl font-bold">Ranking</h1>
      </header>
      <RankingList myUserId={profile.id} />
    </main>
  );
}

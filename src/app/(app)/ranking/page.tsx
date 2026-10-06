'use client';

import { useProfile } from '@/features/profile/profile-context';
import { RankingList } from '@/features/ranking/ranking-list';

export default function RankingPage() {
  const { profile } = useProfile();
  return (
    <main className="mx-auto w-full max-w-md px-4 py-6">
      <h1 className="mb-4 text-2xl font-bold">Ranking</h1>
      <RankingList myUserId={profile.id} />
    </main>
  );
}

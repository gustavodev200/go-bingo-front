'use client';

import Link from 'next/link';
import { Avatar } from '@/components/stage/avatar';
import { Coins } from '@/components/stage/coin';
import { Diamonds } from '@/components/stage/diamond';
import { useProfile } from './profile-context';

/** Player chip (character, nickname, coins, points) linking to the profile page. */
export function ProfilePill() {
  const { profile } = useProfile();
  return (
    <Link href="/perfil" aria-label={`Abrir seu perfil (${profile.nickname})${profile.isGuest ? ', convidado' : ''}`} className="glass flex min-h-11 min-w-0 items-center gap-2 rounded-full py-1 pr-3 pl-1 transition active:scale-95">
      <Avatar id={profile.id} character={profile.character} className="w-8 shrink-0" />
      <span className="flex min-w-0 flex-col leading-tight">
        <span className="truncate text-sm font-semibold">{profile.nickname}</span>
        <span className="flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap text-amber-300">
          <Coins amount={profile.coins} className="shrink-0" />
          {!profile.isGuest && (
            <>
              <span className="text-violet-200/70">·</span>
              <Diamonds amount={profile.diamonds} className="shrink-0 text-cyan-200" />
              <span className="text-violet-200/70">·</span>
              <span>{profile.points} pts</span>
            </>
          )}
        </span>
      </span>
    </Link>
  );
}

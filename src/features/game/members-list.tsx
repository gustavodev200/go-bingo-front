import { Avatar } from '@/components/stage/avatar';
import type { Member } from '@/contracts';
import { cn } from '@/lib/utils';

interface MembersListProps {
  members: Member[];
  hostId: string;
  myUserId: string;
  onKick?: (userId: string) => void;
}

export function MembersList({ members, hostId, myUserId, onKick }: MembersListProps) {
  return (
    <ul className="flex flex-col gap-1.5" aria-label="Jogadores na sala">
      {members.map((m) => (
        <li
          key={m.userId}
          className={cn(
            'flex min-h-11 items-center justify-between gap-2 rounded-2xl border border-white/10 bg-white/5 py-1 pr-2 pl-1.5',
            m.userId === myUserId && 'border-amber-300/50 bg-amber-300/10',
            !m.connected && 'opacity-50',
          )}
        >
          <span className="flex min-w-0 items-center gap-2">
            <Avatar id={m.userId} host={m.userId === hostId} className="w-9" />
            <span className="truncate font-medium">
              {m.userId === hostId && <span aria-label="host">👑 </span>}
              {m.nickname}
              {m.userId === myUserId && ' (você)'}
              {!m.connected && ' · reconectando'}
            </span>
          </span>
          <span className="flex items-center gap-2">
            {m.hasCard && <span className="rounded-full bg-emerald-400/20 px-2 py-0.5 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-400/40">pronto</span>}
            {onKick && m.userId !== myUserId && (
              <button className="text-destructive min-h-11 px-2 text-sm underline" onClick={() => onKick(m.userId)}>
                Remover
              </button>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}

import { Badge } from '@/components/ui/badge';
import type { Member } from '@/contracts';

interface MembersListProps {
  members: Member[];
  hostId: string;
  myUserId: string;
  onKick?: (userId: string) => void;
}

export function MembersList({ members, hostId, myUserId, onKick }: MembersListProps) {
  return (
    <ul className="flex flex-col gap-1" aria-label="Jogadores na sala">
      {members.map((m) => (
        <li key={m.userId} className={`flex min-h-11 items-center justify-between gap-2 rounded px-3 ${m.connected ? '' : 'opacity-50'}`}>
          <span className="truncate">
            {m.userId === hostId && <span aria-label="host">👑 </span>}
            {m.nickname}
            {m.userId === myUserId && ' (você)'}
            {!m.connected && ' · reconectando'}
          </span>
          <span className="flex items-center gap-2">
            {m.hasCard && <Badge variant="secondary">pronto</Badge>}
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

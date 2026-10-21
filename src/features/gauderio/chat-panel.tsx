'use client';

import { MessageCircle, X } from 'lucide-react';
import { useState } from 'react';
import { GAUD_CHAT_TEXT, GAUD_TABLE_CHAT, GAUD_TEAM_CHAT, type GaudChatKey, type GaudChatTo, type GaudRoomState, type GaudSeat } from '@/contracts';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useGaudStore } from './store';

/**
 * Chat rápido de frases prontas: com o parceiro (só a dupla vê; uma CPU parceira
 * responde olhando a mão dela) ou com a mesa toda.
 */
export function ChatPanel({ state, mySeat, onSend }: { state: GaudRoomState; mySeat: GaudSeat; onSend(to: GaudChatTo, key: GaudChatKey): Promise<unknown> }) {
  const [open, setOpen] = useState(false);
  const pairs = state.settings.size === 4;
  const [to, setTo] = useState<GaudChatTo>(pairs ? 'team' : 'table');
  const log = useGaudStore((s) => s.chat);
  const partner = pairs ? state.seats[(mySeat + 2) % 4] : null;
  const channel: GaudChatTo = pairs ? to : 'table';
  const keys: readonly GaudChatKey[] = channel === 'team' ? GAUD_TEAM_CHAT : GAUD_TABLE_CHAT;
  const nameOf = (seat: GaudSeat) => (seat === mySeat ? 'Você' : (state.seats[seat]?.nickname ?? `Lugar ${seat + 1}`));

  async function send(key: GaudChatKey) {
    await onSend(channel, key);
  }

  return (
    <div className="relative">
      <Button variant="secondary" size="icon" className="size-11 rounded-full" aria-label={open ? 'Fechar chat' : 'Abrir chat'} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        {open ? <X aria-hidden /> : <MessageCircle aria-hidden />}
      </Button>
      {open && (
        <div
          role="dialog"
          aria-label="Chat rápido"
          className="absolute bottom-full left-0 z-40 mb-2 flex w-[min(20rem,calc(100vw-1rem))] flex-col gap-2 rounded-2xl bg-violet-950/95 p-3 shadow-2xl ring-1 ring-white/15 backdrop-blur"
        >
          {pairs && (
            <div role="tablist" className="grid grid-cols-2 gap-1 rounded-xl bg-black/30 p-1 text-xs font-bold">
              {(['team', 'table'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={channel === value}
                  onClick={() => setTo(value)}
                  className={cn('rounded-lg px-2 py-1.5', channel === value ? 'bg-amber-300 text-amber-950' : 'text-violet-100')}
                >
                  {value === 'team' ? `Parceiro${partner?.bot ? ' (CPU)' : ''}` : 'Mesa'}
                </button>
              ))}
            </div>
          )}
          <p className="text-[11px] text-violet-200/80">{channel === 'team' ? 'Só a sua dupla vê. A CPU parceira responde olhando as cartas dela.' : 'Todo mundo na mesa vê.'}</p>
          <div className="flex flex-wrap gap-1.5">
            {keys.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => void send(key)}
                className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white ring-1 ring-white/15 hover:bg-white/20 active:scale-95"
              >
                {GAUD_CHAT_TEXT[key]}
              </button>
            ))}
          </div>
          {log.length > 0 && (
            <ol aria-label="Últimas mensagens" className="flex max-h-32 flex-col gap-1 overflow-y-auto border-t border-white/10 pt-2 text-xs">
              {log.slice(-6).map((m) => (
                <li key={m.id} className="leading-snug">
                  <strong className={m.to === 'team' ? 'text-emerald-300' : 'text-amber-200'}>{nameOf(m.seat)}:</strong> <span className="text-violet-50">{m.text}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}

'use client';

import { Check, ChevronLeft, Copy, Crown, Globe, Loader2, Lock, Share2, UserPlus, WifiOff } from 'lucide-react';
import { toast } from 'sonner';
import { GAUD_SIZES, GAUD_TARGETS, gaudTeamOf, type GaudRoomState, type GaudSeat, type GaudSettings } from '@/contracts';
import { Avatar } from '@/components/stage/avatar';
import { Button } from '@/components/ui/button';
import { StakePicker } from '@/features/arena/stake-picker';
import { useBusy } from '@/features/truco/action-bar';
import { TEAM_TONE, useSecondsLeft } from '@/features/truco/seat-badge';
import { cn } from '@/lib/utils';
import type { GaudActionsApi } from './connection';

function SeatCard({ state, seat, mySeat, onTake }: { state: GaudRoomState; seat: GaudSeat; mySeat: GaudSeat; onTake(seat: GaudSeat): void }) {
  const player = state.seats[seat];
  const ours = gaudTeamOf(seat) === gaudTeamOf(mySeat);
  const tone = TEAM_TONE[ours ? 'us' : 'them'];
  const seconds = useSecondsLeft(player?.reconnectDeadline ?? null);
  if (!player)
    return (
      <li className={cn('flex min-h-32 flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed p-3 text-center', ours ? 'border-emerald-300/30' : 'border-rose-300/30')}>
        <span className="text-xs font-semibold text-violet-200/70">Lugar {seat + 1} · vago</span>
        <Button variant="ghost" size="sm" className="h-9 gap-1 rounded-xl text-amber-200" onClick={() => onTake(seat)} aria-label={`Sentar no lugar ${seat + 1}`}>
          <UserPlus aria-hidden className="size-4" /> Sentar aqui
        </Button>
      </li>
    );
  return (
    <li
      className={cn('relative flex min-h-32 flex-col items-center gap-1.5 rounded-3xl p-3 ring-2', tone.bg, tone.ring, !player.connected && 'opacity-60')}
      aria-label={`${player.nickname}${player.ready ? ', pronto' : ''}`}
    >
      {player.userId === state.hostId && <Crown aria-label="Anfitrião" className="absolute top-2 left-2 size-4 fill-amber-300 text-amber-500" />}
      <Avatar id={player.userId} character={player.character} className="w-12" />
      <span className="max-w-full truncate text-sm font-bold">
        {player.nickname}
        {seat === mySeat && <span className="text-violet-200"> (você)</span>}
      </span>
      {player.connected ? (
        <span className={cn('flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold', player.ready ? 'bg-emerald-400 text-emerald-950' : 'bg-white/10 text-violet-100')}>
          {player.ready ? <Check aria-hidden className="size-3" /> : <Loader2 aria-hidden className="size-3 animate-spin motion-reduce:animate-none" />}
          {player.ready ? 'Pronto' : 'Aguardando'}
        </span>
      ) : (
        <span className="flex items-center gap-1 rounded-full bg-amber-500/90 px-2 py-0.5 text-[11px] font-bold text-black">
          <WifiOff aria-hidden className="size-3" /> Reconectando {seconds}s
        </span>
      )}
    </li>
  );
}

/** Grupo de botões de uma regra (anfitrião escolhe, os outros só veem). */
function Choice<T extends string | number | boolean>({
  label,
  value,
  options,
  disabled,
  onPick,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  disabled: boolean;
  onPick(v: T): void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-col gap-1">
      <span className="text-xs font-semibold text-violet-200/80">{label}</span>
      <div className="grid grid-cols-2 gap-2">
        {options.map((o) => {
          const active = o.value === value;
          return (
            <Button
              key={String(o.value)}
              role="radio"
              aria-checked={active}
              variant={active ? 'default' : 'ghost'}
              size="sm"
              className={cn('h-10 rounded-xl', !active && 'text-violet-100')}
              disabled={disabled || active}
              onClick={() => onPick(o.value)}
            >
              {o.label}
            </Button>
          );
        })}
      </div>
    </div>
  );
}

export function RoomLobby({ state, mySeat, actions }: { state: GaudRoomState; mySeat: GaudSeat; actions: GaudActionsApi }) {
  const { busy, run } = useBusy();
  const me = state.seats[mySeat]!;
  const isHost = state.hostId === me.userId;
  const { settings } = state;
  const seated = state.seats.filter(Boolean).length;
  const canStart = isHost && state.lobbyStatus === 'READY_TO_START';
  const change = (patch: Partial<GaudSettings>) => void run(() => actions.setSettings({ ...settings, ...patch }))();

  async function share() {
    const url = `${window.location.origin}/gauderio/${state.code}`;
    if (navigator.share) {
      await navigator.share({ title: 'Truco Gaudério', text: `Bora de truco, tchê? Mesa ${state.code}`, url }).catch(() => undefined);
      return;
    }
    await navigator.clipboard.writeText(url).catch(() => undefined);
    toast.success('Link da mesa copiado!');
  }

  async function copyCode() {
    await navigator.clipboard.writeText(state.code).catch(() => undefined);
    toast.success('Código copiado!');
  }

  // Duas colunas: eu (e meu parceiro) à esquerda, os adversários à direita.
  const order = Array.from({ length: settings.size }, (_, i) => ((mySeat + i) % settings.size) as GaudSeat);

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 pt-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] md:max-w-2xl">
      <header className="flex items-center justify-between gap-2">
        <h1 className="font-display text-marquee text-2xl font-bold">Truco Gaudério</h1>
        <span className="text-sm font-semibold text-violet-200" role="status">
          {seated}/{settings.size} na mesa
        </span>
      </header>

      <StakePicker game="GAUDERIO" stake={state.stake} players={seated} editable={isHost} onChange={actions.setStake} />

      <section className="flex flex-col gap-3 rounded-2xl bg-white/5 px-4 py-3 ring-1 ring-white/10" aria-label="Regras da mesa">
        <Choice
          label="Jogadores"
          value={settings.size}
          disabled={!isHost || busy}
          options={GAUD_SIZES.map((v) => ({ value: v, label: v === 2 ? 'Mano a mano (2)' : 'Duplas (4)' }))}
          onPick={(size) => change({ size })}
        />
        <Choice
          label="Partida até"
          value={settings.target}
          disabled={!isHost || busy}
          options={GAUD_TARGETS.map((v) => ({ value: v, label: `${v} pontos` }))}
          onPick={(target) => change({ target })}
        />
        <Choice
          label="Flor"
          value={settings.flor}
          disabled={!isHost || busy}
          options={[
            { value: true, label: 'Com flor' },
            { value: false, label: 'Sem flor' },
          ]}
          onPick={(flor) => change({ flor })}
        />
        {!isHost && <p className="text-xs text-violet-200/80">Só o anfitrião muda as regras.</p>}
      </section>

      <section className="flex items-center justify-between gap-3 rounded-2xl bg-white/5 px-4 py-2 ring-1 ring-white/10" aria-label="Visibilidade">
        <span className="flex items-center gap-2 text-sm">
          {state.isPublic ? <Globe aria-hidden className="size-4 text-emerald-300" /> : <Lock aria-hidden className="size-4 text-amber-300" />}
          <span>
            <strong>{state.isPublic ? 'Mesa pública' : 'Mesa privada'}</strong>
            <span className="text-violet-200/80"> · {state.isPublic ? 'aparece na lista' : 'só entra quem tem o código'}</span>
          </span>
        </span>
        {isHost && (
          <Button variant="ghost" size="sm" className="h-9 shrink-0 rounded-xl text-amber-200" disabled={busy} onClick={run(() => actions.setVisibility(!state.isPublic))}>
            {state.isPublic ? 'Tornar privada' : 'Tornar pública'}
          </Button>
        )}
      </section>

      <section className="glass flex items-center justify-between gap-3 rounded-2xl border-dashed border-amber-300/40 px-4 py-3" aria-label="Código da mesa">
        <button type="button" onClick={() => void copyCode()} className="flex flex-col text-left" aria-label={`Copiar código ${state.code}`}>
          <span className="text-xs font-semibold tracking-[0.25em] text-pink-300 uppercase">Código</span>
          <strong className="flex items-center gap-2 font-mono text-2xl font-bold tracking-[0.3em] text-amber-300">
            {state.code} <Copy aria-hidden className="size-4 text-amber-200/70" />
          </strong>
        </button>
        <Button variant="outline" className="h-11 gap-2 rounded-xl" onClick={() => void share()}>
          <Share2 aria-hidden /> Convidar
        </Button>
      </section>

      <section aria-label="Lugares" className="flex flex-col gap-2">
        <div className="flex justify-between px-1 text-xs font-bold tracking-widest uppercase">
          <span className="text-emerald-300">{settings.size === 2 ? 'Você' : 'Sua dupla'}</span>
          <span className="text-rose-300">{settings.size === 2 ? 'Adversário' : 'Adversários'}</span>
        </div>
        <ul className="grid grid-cols-2 gap-3">
          {order.map((seat) => (
            <SeatCard key={seat} state={state} seat={seat} mySeat={mySeat} onTake={(s) => void actions.takeSeat(s)} />
          ))}
        </ul>
        {settings.size === 4 && <p className="text-center text-xs text-violet-200/80">Parceiros sentam frente a frente. Troque de lugar para escolher sua dupla.</p>}
      </section>

      <section className="flex flex-col gap-2">
        <Button size="lg" variant={me.ready ? 'secondary' : 'default'} className="h-12 rounded-xl text-base" disabled={busy} onClick={run(() => actions.ready(!me.ready))}>
          {me.ready ? 'Não estou pronto' : 'Estou pronto!'}
        </Button>
        {isHost ? (
          <Button
            size="lg"
            className="h-12 rounded-xl from-emerald-300 to-emerald-600 text-base text-white [--primary-shadow:var(--color-emerald-800)]"
            disabled={!canStart || busy}
            onClick={run(actions.start)}
          >
            Começar partida
          </Button>
        ) : (
          <p className="text-center text-sm text-violet-200" role="status">
            {state.lobbyStatus === 'READY_TO_START' ? 'Tudo pronto! Esperando o anfitrião começar.' : `Esperando ${settings.size} jogadores prontos…`}
          </p>
        )}
        {isHost && !canStart && <p className="text-center text-xs text-violet-200/80">A partida começa com {settings.size} jogadores conectados e prontos.</p>}
      </section>

      <nav className="flex items-center text-sm">
        <Button variant="ghost" className="h-11 gap-1 rounded-xl text-violet-200" disabled={busy} onClick={run(actions.leave)}>
          <ChevronLeft aria-hidden className="size-4" /> Sair da mesa
        </Button>
      </nav>
    </main>
  );
}

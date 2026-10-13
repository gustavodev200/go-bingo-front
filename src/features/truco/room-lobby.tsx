'use client';

import { Check, ChevronLeft, Copy, Crown, Globe, Loader2, Lock, Share2, UserPlus, WifiOff } from 'lucide-react';
import { toast } from 'sonner';
import { teamOf, TRUCO_MODES, TRUCO_RULES, TRUCO_SEATS, type Seat, type TrucoRoomState } from '@/contracts';
import { Avatar } from '@/components/stage/avatar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useBusy } from './action-bar';
import type { TrucoActions } from './connection';
import { rulesOf } from './rules-view';
import { TEAM_TONE, useSecondsLeft } from './seat-badge';
import type { Conventions } from './signals';
import { SignalsDialog } from './signals-settings';

function SeatCard({ state, seat, mySeat, onTake }: { state: TrucoRoomState; seat: Seat; mySeat: Seat; onTake(seat: Seat): void }) {
  const player = state.seats[seat];
  const ours = teamOf(seat) === teamOf(mySeat);
  const tone = TEAM_TONE[ours ? 'us' : 'them'];
  const seconds = useSecondsLeft(player?.reconnectDeadline ?? null);
  if (!player) {
    return (
      <li className={cn('flex min-h-32 flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed p-3 text-center', ours ? 'border-emerald-300/30' : 'border-rose-300/30')}>
        <span className="text-xs font-semibold text-violet-200/70">Lugar {seat + 1} · vago</span>
        <Button variant="ghost" size="sm" className="h-9 gap-1 rounded-xl text-amber-200" onClick={() => onTake(seat)} aria-label={`Sentar no lugar ${seat + 1}`}>
          <UserPlus aria-hidden className="size-4" /> Sentar aqui
        </Button>
      </li>
    );
  }
  return (
    <li className={cn('relative flex min-h-32 flex-col items-center gap-1.5 rounded-3xl p-3 ring-2', tone.bg, tone.ring, !player.connected && 'opacity-60')} aria-label={`${player.nickname}${player.ready ? ', pronto' : ''}`}>
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

export function RoomLobby({ state, mySeat, actions, conventions, setConventions }: { state: TrucoRoomState; mySeat: Seat; actions: TrucoActions; conventions: Conventions; setConventions(next: Conventions): void }) {
  const { busy, run } = useBusy();
  const me = state.seats[mySeat]!;
  const isHost = state.hostId === me.userId;
  const seated = state.seats.filter(Boolean).length;
  const canStart = isHost && state.lobbyStatus === 'READY_TO_START';
  const rules = rulesOf(state.mode);

  async function share() {
    const url = `${window.location.origin}/truco/${state.code}`;
    if (navigator.share) {
      await navigator.share({ title: rules.name, text: `Bora de truco? Mesa ${state.code}`, url }).catch(() => undefined);
      return;
    }
    await navigator.clipboard.writeText(url).catch(() => undefined);
    toast.success('Link da mesa copiado!');
  }

  async function copyCode() {
    await navigator.clipboard.writeText(state.code).catch(() => undefined);
    toast.success('Código copiado!');
  }

  // Two columns: me and my partner on the left, the opponents on the right.
  const order = [0, 1, 2, 3].map((i) => ((mySeat + i) % 4) as Seat);

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 pt-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] md:max-w-2xl">
      <header className="flex items-center justify-between gap-2">
        <h1 className="font-display text-marquee text-2xl font-bold">{rules.name}</h1>
        <span className="text-sm font-semibold text-violet-200" role="status">
          {seated}/{TRUCO_SEATS} na mesa
        </span>
      </header>

      <section className="flex flex-col gap-2 rounded-2xl bg-white/5 px-4 py-3 ring-1 ring-white/10" aria-label="Modo">
        <div role="radiogroup" aria-label="Modo de jogo" className="grid grid-cols-2 gap-2">
          {TRUCO_MODES.map((mode) => {
            const active = rules === TRUCO_RULES[mode];
            return (
              <Button
                key={mode}
                role="radio"
                aria-checked={active}
                variant={active ? 'default' : 'ghost'}
                size="sm"
                className={cn('h-10 rounded-xl', !active && 'text-violet-100')}
                disabled={!isHost || busy || active}
                onClick={run(() => actions.setMode(mode))}
              >
                {TRUCO_RULES[mode].name}
              </Button>
            );
          })}
        </div>
        <p className="text-xs text-violet-200/80">
          Até {rules.targetScore} tentos · {rules.tenHandName.toLowerCase()} vale {rules.tenHandValue}, correndo dá {rules.tenRunPoints}
          {rules.ironHand ? ` · ${rules.tenThreshold} a ${rules.tenThreshold} é mão de ferro` : ` · ${rules.tenThreshold} a ${rules.tenThreshold} sem mão de ferro`}
          {!isHost && ' · só o anfitrião troca o modo'}
        </p>
      </section>

      <section className="flex items-center justify-between gap-3 rounded-2xl bg-white/5 px-4 py-2 ring-1 ring-white/10" aria-label="Visibilidade">
        <span className="flex items-center gap-2 text-sm">
          {state.isPublic ? <Globe aria-hidden className="size-4 text-emerald-300" /> : <Lock aria-hidden className="size-4 text-amber-300" />}
          <span>
            <strong>{state.isPublic ? 'Mesa pública' : 'Mesa privada'}</strong>
            <span className="text-violet-200/80"> · {state.isPublic ? 'aparece na lista do truco' : 'só entra quem tem o código'}</span>
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
          <span className="text-emerald-300">Sua dupla</span>
          <span className="text-rose-300">Adversários</span>
        </div>
        <ul className="grid grid-cols-2 gap-3">
          {order.map((seat) => (
            <SeatCard key={seat} state={state} seat={seat} mySeat={mySeat} onTake={(s) => void actions.takeSeat(s)} />
          ))}
        </ul>
        <p className="text-center text-xs text-violet-200/80">Parceiros sentam frente a frente. Troque de lugar para escolher sua dupla.</p>
      </section>

      <section className="flex flex-col gap-2">
        <Button size="lg" variant={me.ready ? 'secondary' : 'default'} className="h-12 rounded-xl text-base" disabled={busy} onClick={run(() => actions.ready(!me.ready))}>
          {me.ready ? 'Não estou pronto' : 'Estou pronto!'}
        </Button>
        {isHost ? (
          <Button size="lg" className="h-12 rounded-xl from-emerald-300 to-emerald-600 text-base text-white [--primary-shadow:var(--color-emerald-800)]" disabled={!canStart || busy} onClick={run(actions.start)}>
            Começar partida
          </Button>
        ) : (
          <p className="text-center text-sm text-violet-200" role="status">
            {state.lobbyStatus === 'READY_TO_START' ? 'Tudo pronto! Esperando o anfitrião começar.' : 'Esperando 4 jogadores prontos…'}
          </p>
        )}
        {isHost && !canStart && <p className="text-center text-xs text-violet-200/80">A partida começa com 4 jogadores conectados e prontos.</p>}
      </section>

      <nav className="flex items-center justify-between gap-3 text-sm">
        <Button variant="ghost" className="h-11 gap-1 rounded-xl text-violet-200" disabled={busy} onClick={run(actions.leave)}>
          <ChevronLeft aria-hidden className="size-4" /> Sair da mesa
        </Button>
        <SignalsDialog conventions={conventions} onChange={setConventions} />
      </nav>
    </main>
  );
}

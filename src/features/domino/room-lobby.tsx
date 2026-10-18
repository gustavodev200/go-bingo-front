'use client';

import { Check, ChevronLeft, Copy, Crown, Globe, Loader2, Lock, Share2, WifiOff } from 'lucide-react';
import { toast } from 'sonner';
import { DOMINO_MIN_PLAYERS, DOMINO_SEATS, DOMINO_TARGETS, dominoTeamOf, type DominoRoomState, type DominoRules } from '@/contracts';
import { Avatar } from '@/components/stage/avatar';
import { Button } from '@/components/ui/button';
import { useBusy } from '@/features/truco/action-bar';
import { useSecondsLeft } from '@/features/truco/seat-badge';
import { cn } from '@/lib/utils';
import type { DominoActions } from './connection';
import { TeamBadge } from './opponent-seat';
import { TARGET_LABEL } from './rules-view';

const TARGET_HINT: Record<number, string> = { 0: 'Quem bater vence', 50: 'Partida rápida', 100: 'Partida completa' };

function SeatCard({ state, seat, mySeat }: { state: DominoRoomState; seat: number; mySeat: number }) {
  const player = state.seats[seat];
  const seconds = useSecondsLeft(player?.reconnectDeadline ?? null);
  if (!player)
    return (
      <li className="flex min-h-28 flex-col items-center justify-center rounded-3xl border-2 border-dashed border-white/20 p-3 text-center">
        <span className="text-xs font-semibold text-white/60">Lugar vago</span>
      </li>
    );
  return (
    <li
      className={cn('relative flex min-h-28 flex-col items-center gap-1.5 rounded-3xl bg-white/10 p-3 ring-2', seat === mySeat ? 'ring-amber-300' : 'ring-white/20', !player.connected && 'opacity-60')}
      aria-label={`${player.nickname}${player.ready ? ', pronto' : ''}`}
    >
      {player.userId === state.hostId && <Crown aria-label="Anfitrião" className="absolute top-2 left-2 size-4 fill-amber-300 text-amber-500" />}
      {state.rules.teams && (
        <span className="absolute top-2 right-2">
          <TeamBadge team={dominoTeamOf(seat)} mine={dominoTeamOf(seat) === dominoTeamOf(mySeat)} />
        </span>
      )}
      <Avatar id={player.userId} character={player.character} className="w-11" />
      <span className="max-w-full truncate text-sm font-bold">
        {player.nickname}
        {seat === mySeat && <span className="text-amber-200"> (você)</span>}
      </span>
      {player.connected ? (
        <span className={cn('flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold', player.ready ? 'bg-emerald-400 text-emerald-950' : 'bg-white/10 text-white')}>
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

function RulesForm({ rules, editable, onChange }: { rules: DominoRules; editable: boolean; onChange(next: DominoRules): void }) {
  return (
    <section className="glass flex flex-col gap-3 p-4" aria-labelledby="domino-rules-title">
      <h2 id="domino-rules-title" className="font-display text-lg font-semibold">
        Regras da mesa {!editable && <span className="text-xs font-normal text-white/70">(o anfitrião escolhe)</span>}
      </h2>
      <fieldset className="flex flex-col gap-2" disabled={!editable}>
        <legend className="mb-1 text-sm font-medium">Modo</legend>
        <div className="grid grid-cols-3 gap-2">
          {DOMINO_TARGETS.map((target) => (
            <label
              key={target}
              className="flex min-h-11 cursor-pointer flex-col justify-center rounded-xl border border-white/15 px-2 py-2 text-center has-checked:border-amber-300/70 has-checked:bg-amber-300/15 has-disabled:cursor-default"
            >
              <input
                type="radio"
                name="domino-target"
                className="sr-only"
                checked={rules.target === target}
                onChange={() => onChange({ ...rules, target })}
                aria-describedby={`domino-target-${target}`}
              />
              <span className="text-sm leading-tight font-semibold">{TARGET_LABEL[target]}</span>
              <span id={`domino-target-${target}`} className="text-[11px] leading-tight text-white/70">
                {TARGET_HINT[target]}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="flex flex-col gap-2" disabled={!editable}>
        <legend className="mb-1 text-sm font-medium">Times</legend>
        <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-white/15 px-3 py-2 has-checked:border-amber-300/70 has-checked:bg-amber-300/15 has-disabled:cursor-default">
          <input type="checkbox" className="size-5 accent-amber-400" checked={rules.teams} onChange={(e) => onChange({ ...rules, teams: e.target.checked })} />
          <span className="flex flex-col leading-tight">
            <span className="text-sm font-semibold">Duplas (2 contra 2)</span>
            <span className="text-xs text-white/70">Precisa de 4 jogadores; o parceiro senta à sua frente</span>
          </span>
        </label>
      </fieldset>
    </section>
  );
}

export function RoomLobby({ state, mySeat, actions }: { state: DominoRoomState; mySeat: number; actions: DominoActions }) {
  const { busy, run } = useBusy();
  const me = state.seats[mySeat]!;
  const isHost = state.hostId === me.userId;
  const seated = state.seats.filter(Boolean).length;
  const canStart = isHost && state.lobbyStatus === 'READY_TO_START';

  async function share() {
    const url = `${window.location.origin}/domino/${state.code}`;
    if (navigator.share) {
      await navigator.share({ title: 'Dominó', text: `Bora de dominó? Mesa ${state.code}`, url }).catch(() => undefined);
      return;
    }
    await navigator.clipboard.writeText(url).catch(() => undefined);
    toast.success('Link da mesa copiado!');
  }

  async function copyCode() {
    await navigator.clipboard.writeText(state.code).catch(() => undefined);
    toast.success('Código copiado!');
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 pt-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] md:max-w-2xl">
      <header className="flex items-center justify-between gap-2">
        <h1 className="font-display text-marquee text-2xl font-bold">Dominó</h1>
        <span className="text-sm font-semibold text-violet-200" role="status">
          {seated}/{DOMINO_SEATS} na mesa
        </span>
      </header>

      <section className="flex items-center justify-between gap-3 rounded-2xl bg-white/5 px-4 py-2 ring-1 ring-white/10" aria-label="Visibilidade">
        <span className="flex items-center gap-2 text-sm">
          {state.isPublic ? <Globe aria-hidden className="size-4 text-emerald-300" /> : <Lock aria-hidden className="size-4 text-amber-300" />}
          <span>
            <strong>{state.isPublic ? 'Mesa pública' : 'Mesa privada'}</strong>
            <span className="text-violet-200/80"> · {state.isPublic ? 'aparece na lista do dominó' : 'só entra quem tem o código'}</span>
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

      <section aria-label="Lugares">
        <ul className="grid grid-cols-2 gap-2">
          {state.seats.map((_, seat) => (
            <SeatCard key={seat} state={state} seat={seat} mySeat={mySeat} />
          ))}
        </ul>
      </section>

      <RulesForm rules={state.rules} editable={isHost} onChange={(rules) => void actions.setRules(rules)} />

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
            {state.lobbyStatus === 'READY_TO_START' ? 'Tudo pronto! Esperando o anfitrião começar.' : 'Esperando todo mundo ficar pronto…'}
          </p>
        )}
        {isHost && !canStart && (
          <p className="text-center text-xs text-violet-200/80">
            {state.rules.teams ? 'Em duplas a partida começa com 4 jogadores' : `A partida começa com ${DOMINO_MIN_PLAYERS} a ${DOMINO_SEATS} jogadores`} conectados e prontos.
          </p>
        )}
      </section>

      <nav className="flex items-center text-sm">
        <Button variant="ghost" className="h-11 gap-1 rounded-xl text-violet-200" disabled={busy} onClick={run(actions.leave)}>
          <ChevronLeft aria-hidden className="size-4" /> Sair da mesa
        </Button>
      </nav>
    </main>
  );
}

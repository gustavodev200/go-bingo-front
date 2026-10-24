'use client';

import { ArrowLeftRight, Check, ChevronLeft, Copy, Crown, Globe, Lock, Play, Share2, WifiOff } from 'lucide-react';
import { toast } from 'sonner';
import { BOTAO_GOAL_LIMITS, BOTAO_MINUTES, BOTAO_TEAM_SIZE, BOTAO_TEAMS, type BotaoRoomState, type BotaoRules, type BotaoSeatPlayer } from '@/contracts';
import { Avatar } from '@/components/stage/avatar';
import { Button } from '@/components/ui/button';
import { AddCpuButton, CpuTag, RemoveCpuButton } from '@/features/arena/cpu';
import { StakePicker } from '@/features/arena/stake-picker';
import { useBusy } from '@/features/truco/action-bar';
import { useSecondsLeft } from '@/features/truco/seat-badge';
import { cn } from '@/lib/utils';
import type { BotaoActions } from './connection';

function PlayerRow({ state, player, mySeat, actions }: { state: BotaoRoomState; player: BotaoSeatPlayer; mySeat: number; actions: BotaoActions }) {
  const seconds = useSecondsLeft(player.reconnectDeadline);
  const isHost = state.hostId === state.seats[mySeat]?.userId;
  const mine = player.seat === mySeat;
  return (
    <li
      aria-label={`${player.nickname}${player.ready ? ', pronto' : ''}`}
      className={cn('flex min-h-14 items-center gap-2 rounded-xl bg-black/25 px-2 py-1.5', mine && 'ring-2 ring-amber-300', !player.connected && 'opacity-60')}
    >
      <Avatar id={player.userId} character={player.character} className="w-9 shrink-0" />
      <span className="flex min-w-0 flex-1 flex-col leading-tight">
        <span className="flex items-center gap-1">
          <b className="truncate text-sm">{player.nickname}</b>
          {player.userId === state.hostId && <Crown aria-label="Anfitrião" className="size-4 shrink-0 fill-amber-300 text-amber-500" />}
          {player.bot && <CpuTag />}
          {mine && <span className="rounded-md bg-amber-300 px-1.5 text-[10px] font-black text-amber-950">VOCÊ</span>}
        </span>
        {player.connected ? (
          <span className={cn('flex items-center gap-0.5 text-[11px] font-bold', player.ready ? 'text-emerald-300' : 'text-white/55')}>
            {player.ready && <Check aria-hidden className="size-3" />}
            {player.ready ? 'Pronto' : 'Escolhendo…'}
          </span>
        ) : (
          <span className="flex items-center gap-0.5 text-[11px] font-bold text-amber-300">
            <WifiOff aria-hidden className="size-3" /> {seconds}s
          </span>
        )}
      </span>
      {isHost && player.bot && <RemoveCpuButton name={player.nickname} onRemove={() => actions.removeBot(player.seat)} />}
    </li>
  );
}

function TeamColumn({ state, team, mySeat, actions }: { state: BotaoRoomState; team: 0 | 1; mySeat: number; actions: BotaoActions }) {
  const info = BOTAO_TEAMS[team];
  const seats = state.seats.slice(team * BOTAO_TEAM_SIZE, (team + 1) * BOTAO_TEAM_SIZE);
  const players = seats.filter((s): s is BotaoSeatPlayer => s !== null);
  const isHost = state.hostId === state.seats[mySeat]?.userId;
  const myTeam = mySeat < BOTAO_TEAM_SIZE ? 0 : 1;
  const full = players.length >= BOTAO_TEAM_SIZE;
  return (
    <section
      aria-labelledby={`botao-team-${team}`}
      className="flex min-w-0 flex-col gap-2 rounded-2xl p-2.5 ring-1 ring-white/10"
      style={{ background: `linear-gradient(180deg, ${info.color}40, ${info.dark}33)` }}
    >
      <header className="flex items-center gap-2">
        <span aria-hidden className="size-4 rounded-full border-2 border-black/70" style={{ background: info.color }} />
        <h2 id={`botao-team-${team}`} className="font-display flex-1 text-lg font-bold">
          {info.name}{' '}
          <span className="text-sm text-white/60 tabular-nums">
            {players.length}/{BOTAO_TEAM_SIZE}
          </span>
        </h2>
        {myTeam !== team && (
          <Button size="sm" variant="secondary" className="h-9 gap-1 rounded-xl font-bold" disabled={full} onClick={() => void actions.setTeam(team)}>
            <ArrowLeftRight aria-hidden className="size-4" /> Entrar
          </Button>
        )}
      </header>
      <ul className="flex flex-col gap-1.5" aria-label={`Time ${info.name}`}>
        {players.map((p) => (
          <PlayerRow key={p.userId} state={state} player={p} mySeat={mySeat} actions={actions} />
        ))}
        {!full && (
          <li className="flex min-h-14 items-center justify-center rounded-xl border-2 border-dashed border-white/15 px-2">
            {isHost ? <AddCpuButton onAdd={() => actions.addBot(team)} /> : <span className="text-sm font-semibold text-white/45">Lugar livre</span>}
          </li>
        )}
      </ul>
    </section>
  );
}

function RuleChoice<T extends number>({
  legend,
  name,
  options,
  value,
  label,
  disabled,
  onPick,
}: {
  legend: string;
  name: string;
  options: readonly T[];
  value: T;
  label(v: T): string;
  disabled: boolean;
  onPick(v: T): void;
}) {
  return (
    <fieldset className="flex items-center gap-1 rounded-xl bg-black/25 px-2 py-1" disabled={disabled}>
      <legend className="sr-only">{legend}</legend>
      <span aria-hidden className="pr-1 text-xs font-bold text-white/70">
        {legend}
      </span>
      {options.map((v) => (
        <label
          key={v}
          className="grid h-8 min-w-8 cursor-pointer place-items-center rounded-lg px-1.5 text-sm font-black has-checked:bg-emerald-400 has-checked:text-emerald-950 has-disabled:cursor-default"
        >
          <input type="radio" name={name} className="sr-only" checked={value === v} onChange={() => onPick(v)} />
          {label(v)}
        </label>
      ))}
    </fieldset>
  );
}

/** Vestiário: escolha o time, chame a CPU, ajuste tempo e gols e confirme que está pronto. */
export function RoomLobby({ state, mySeat, actions }: { state: BotaoRoomState; mySeat: number; actions: BotaoActions }) {
  const { busy, run } = useBusy();
  const me = state.seats[mySeat];
  const isHost = state.hostId === me?.userId;
  const counts = [0, 1].map((t) => state.seats.slice(t * BOTAO_TEAM_SIZE, (t + 1) * BOTAO_TEAM_SIZE).filter(Boolean).length);
  const canStart = state.lobbyStatus === 'READY_TO_START';
  const setRules = (rules: Partial<BotaoRules>) => void actions.setRules({ ...state.rules, ...rules });

  async function share() {
    const url = `${window.location.origin}/botao/${state.code}`;
    try {
      if (navigator.share) await navigator.share({ title: 'Futebol de Botão', text: `Bora um racha! Sala ${state.code}`, url });
      else {
        await navigator.clipboard.writeText(url);
        toast.success('Link copiado!');
      }
    } catch {
      /* folha de compartilhar fechada */
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-3 px-3 pt-[calc(0.5rem+env(safe-area-inset-top))] pb-[calc(1rem+env(safe-area-inset-bottom))]">
      <header className="flex items-center gap-2">
        <Button variant="ghost" size="icon" aria-label="Sair da sala" className="size-11 shrink-0 rounded-full" disabled={busy} onClick={run(actions.leave)}>
          <ChevronLeft aria-hidden />
        </Button>
        <h1 className="font-display text-marquee flex-1 truncate text-2xl font-bold sm:text-3xl">Vestiário</h1>
        <div className="glass flex items-center gap-1 rounded-full py-1 pr-1 pl-3">
          <span className="sr-only">Código da sala</span>
          <b className="font-mono text-base tracking-[0.2em] sm:text-lg">{state.code}</b>
          <button type="button" aria-label="Compartilhar sala" onClick={() => void share()} className="grid size-8 place-items-center rounded-full bg-white/10">
            {typeof navigator !== 'undefined' && 'share' in navigator ? <Share2 aria-hidden className="size-4" /> : <Copy aria-hidden className="size-4" />}
          </button>
        </div>
      </header>

      <StakePicker
        game="BOTAO"
        stake={state.stake}
        players={state.seats.filter((s) => s && !s.bot).length}
        editable={isHost}
        onChange={actions.setStake}
        cpu={state.seats.filter((s) => s?.bot).length}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <TeamColumn state={state} team={0} mySeat={mySeat} actions={actions} />
        <TeamColumn state={state} team={1} mySeat={mySeat} actions={actions} />
      </div>

      <section aria-label="Regras" className="flex flex-wrap items-center justify-center gap-2">
        <RuleChoice legend="Tempo" name="botao-minutes" options={BOTAO_MINUTES} value={state.rules.minutes} label={(v) => `${v}'`} disabled={!isHost} onPick={(minutes) => setRules({ minutes })} />
        <RuleChoice
          legend="Gols"
          name="botao-goals"
          options={BOTAO_GOAL_LIMITS}
          value={state.rules.goals}
          label={(v) => (v ? String(v) : '∞')}
          disabled={!isHost}
          onPick={(goals) => setRules({ goals })}
        />
      </section>

      <section aria-label="Partida" className="flex flex-wrap items-center justify-center gap-2">
        {isHost && (
          <Button variant="secondary" className="h-11 gap-1 rounded-xl font-bold" onClick={() => void actions.setVisibility(!state.isPublic)}>
            {state.isPublic ? <Globe aria-hidden /> : <Lock aria-hidden />}
            {state.isPublic ? 'Pública' : 'Privada'}
          </Button>
        )}
        {me && !me.bot && (
          <Button
            variant="secondary"
            aria-pressed={me.ready}
            className={cn('h-11 gap-1 rounded-xl font-bold', me.ready && 'bg-emerald-400 text-emerald-950 hover:bg-emerald-300')}
            disabled={busy}
            onClick={run(() => actions.ready(!me.ready))}
          >
            <Check aria-hidden /> {me.ready ? 'Pronto!' : 'Estou pronto'}
          </Button>
        )}
        {isHost && (
          <Button className="h-11 gap-1 rounded-xl px-5 font-black" disabled={busy || !canStart} onClick={run(actions.start)}>
            <Play aria-hidden className="fill-current" /> Começar
          </Button>
        )}
      </section>

      <p className="text-center text-sm font-semibold text-white/70" role="status">
        {counts[0] === 0 || counts[1] === 0
          ? isHost
            ? 'Cada time precisa de alguém: chame a galera ou a CPU'
            : 'Esperando os dois times terem jogador…'
          : canStart
            ? isHost
              ? 'Tudo pronto! Toque em Começar'
              : 'Tudo pronto! Esperando o anfitrião'
            : 'Escolha o time e confirme que está pronto'}
      </p>
    </main>
  );
}

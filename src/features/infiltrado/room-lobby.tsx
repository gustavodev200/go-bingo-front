'use client';

import { Bot, Check, ChevronLeft, ChevronRight, Copy, Crown, Globe, Lock, Play, Share2, WifiOff, X } from 'lucide-react';
import { toast } from 'sonner';
import { INF_COLORS, INF_MIN_PLAYERS, INF_SEATS, infMaxImpostors, type InfRoomState, type InfRules, type InfSeatPlayer } from '@/contracts';
import { Button } from '@/components/ui/button';
import { StakePicker } from '@/features/arena/stake-picker';
import { useBusy } from '@/features/truco/action-bar';
import { useSecondsLeft } from '@/features/truco/seat-badge';
import { cn } from '@/lib/utils';
import type { InfActions } from './connection';
import { DiverIcon } from './diver-icon';

/** Next color nobody else picked, walking `step` (±1) from the current one. */
export function nextFreeColor(state: InfRoomState, mySeat: number, step: 1 | -1): number | null {
  const mine = state.seats[mySeat]?.color ?? 0;
  const taken = new Set(state.seats.filter((s, i) => s && i !== mySeat).map((s) => s!.color));
  const n = INF_COLORS.length;
  for (let i = 1; i < n; i++) {
    const c = (((mine + step * i) % n) + n) % n;
    if (!taken.has(c)) return c;
  }
  return null;
}

function SeatCard({ state, seat, mySeat, actions }: { state: InfRoomState; seat: number; mySeat: number; actions: InfActions }) {
  const player: InfSeatPlayer | null = state.seats[seat];
  const seconds = useSecondsLeft(player?.reconnectDeadline ?? null);
  const isHost = state.hostId === state.seats[mySeat]?.userId;

  if (!player)
    return (
      <li className="flex min-h-28 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-cyan-200/20 bg-white/5 p-2">
        {isHost ? (
          <Button size="sm" variant="secondary" className="gap-1 rounded-xl" onClick={() => void actions.addBot()}>
            <Bot aria-hidden className="size-4" /> + CPU
          </Button>
        ) : (
          <span className="text-xs text-slate-400">Livre</span>
        )}
      </li>
    );

  const color = INF_COLORS[player.color] ?? INF_COLORS[0];
  const mine = seat === mySeat;
  const step = (dir: 1 | -1) => {
    const next = nextFreeColor(state, mySeat, dir);
    if (next !== null) void actions.setColor(next);
  };
  return (
    <li
      aria-label={`${player.nickname}, ${color.name}${player.ready ? ', pronto' : ''}`}
      className={cn(
        'relative flex min-h-28 flex-col items-center justify-end overflow-hidden rounded-2xl border-2 bg-[#0b2a3d]',
        mine ? 'border-cyan-300 ring-2 ring-cyan-300/60' : 'border-cyan-200/15',
        !player.connected && 'opacity-60',
      )}
    >
      <span className="absolute top-1.5 right-1.5 flex gap-1">
        {player.userId === state.hostId && <Crown aria-label="Anfitrião" className="size-4 fill-amber-300 text-amber-500" />}
        {player.bot && <span className="rounded bg-slate-300 px-1 text-[9px] font-black text-slate-900">CPU</span>}
      </span>
      {isHost && player.bot && (
        <button
          type="button"
          aria-label={`Tirar ${player.nickname}`}
          onClick={() => void actions.removeBot(seat)}
          className="absolute top-1.5 left-1.5 grid size-6 place-items-center rounded-full bg-white/90 text-slate-900"
        >
          <X aria-hidden className="size-3.5" />
        </button>
      )}
      <DiverIcon color={player.color} animate className="mt-4 size-16" />
      <div className="flex w-full items-center justify-between bg-black/30 px-0.5 py-1">
        {mine ? (
          <button type="button" aria-label="Cor anterior" onClick={() => step(-1)} className="grid size-8 place-items-center text-cyan-300">
            <ChevronLeft aria-hidden className="size-5" />
          </button>
        ) : (
          <span className="size-8" />
        )}
        <span className="flex min-w-0 flex-1 flex-col items-center leading-tight">
          <b className="max-w-full truncate text-xs">{player.nickname}</b>
          {player.connected ? (
            <span className={cn('flex items-center gap-0.5 text-[10px] font-bold', player.ready ? 'text-emerald-400' : 'text-slate-400')}>
              {player.ready && <Check aria-hidden className="size-3" />}
              {player.ready ? 'Pronto' : color.name}
            </span>
          ) : (
            <span className="flex items-center gap-0.5 text-[10px] font-bold text-amber-400">
              <WifiOff aria-hidden className="size-3" /> {seconds}s
            </span>
          )}
        </span>
        {mine ? (
          <button type="button" aria-label="Próxima cor" onClick={() => step(1)} className="grid size-8 place-items-center text-cyan-300">
            <ChevronRight aria-hidden className="size-5" />
          </button>
        ) : (
          <span className="size-8" />
        )}
      </div>
    </li>
  );
}

function Choice<K extends keyof InfRules>({
  label,
  field,
  options,
  state,
  disabled,
  onChange,
  format,
}: {
  label: string;
  field: K;
  options: readonly InfRules[K][];
  state: InfRoomState;
  disabled: boolean;
  onChange(rules: InfRules): void;
  format?: (v: InfRules[K]) => string;
}) {
  return (
    <fieldset disabled={disabled} className="flex flex-col gap-1">
      <legend className="mb-1 text-xs font-semibold text-slate-300">{label}</legend>
      <div className="flex flex-wrap gap-1">
        {options.map((v) => (
          <label
            key={String(v)}
            className="flex h-9 min-w-10 cursor-pointer items-center justify-center rounded-lg border border-cyan-200/20 px-2 text-sm font-bold has-checked:border-cyan-300 has-checked:bg-cyan-400 has-checked:text-slate-950 has-disabled:cursor-default"
          >
            <input type="radio" className="sr-only" name={`inf-${field}`} checked={state.rules[field] === v} onChange={() => onChange({ ...state.rules, [field]: v })} />
            {format ? format(v) : String(v)}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** Waiting room: 15 seats, colors, CPUs, the host's rules and the ready check. */
export function RoomLobby({ state, mySeat, actions }: { state: InfRoomState; mySeat: number; actions: InfActions }) {
  const { busy, run } = useBusy();
  const me = state.seats[mySeat];
  const isHost = state.hostId === me?.userId;
  const players = state.seats.filter(Boolean).length;
  const canStart = state.lobbyStatus === 'READY_TO_START';
  const effectiveImpostors = Math.min(state.rules.impostors, infMaxImpostors(players));
  const setRules = (rules: InfRules) => void actions.setRules(rules);
  const secs = (v: number | boolean) => `${String(v)}s`;

  async function share() {
    const url = `${window.location.origin}/infiltrado/${state.code}`;
    try {
      if (navigator.share) await navigator.share({ title: 'Infiltrado', text: `Tem um infiltrado na estação! Sala ${state.code}`, url });
      else {
        await navigator.clipboard.writeText(url);
        toast.success('Link copiado!');
      }
    } catch {
      /* share sheet closed */
    }
  }

  return (
    <main className="flex min-h-dvh flex-col bg-[radial-gradient(ellipse_at_top,#0c3b57,#03101c_70%)] text-white">
      <header className="flex items-center gap-3 px-3 pt-[calc(0.5rem+env(safe-area-inset-top))] pb-2">
        <Button variant="ghost" size="icon" aria-label="Sair da sala" className="size-11 shrink-0 rounded-full border-2 border-white/60" disabled={busy} onClick={run(actions.leave)}>
          <ChevronLeft aria-hidden />
        </Button>
        <h1 className="font-display flex-1 truncate text-xl font-bold tracking-wide sm:text-3xl">INFILTRADO</h1>
        <div className="flex items-center gap-1 rounded-full border-2 border-cyan-300 bg-slate-950/60 py-1 pr-1 pl-3">
          <span className="sr-only">Código da sala</span>
          <b className="font-mono text-base tracking-[0.2em] sm:text-lg">{state.code}</b>
          <button type="button" aria-label="Compartilhar sala" onClick={() => void share()} className="grid size-8 place-items-center rounded-full bg-white/10">
            {typeof navigator !== 'undefined' && 'share' in navigator ? <Share2 aria-hidden className="size-4" /> : <Copy aria-hidden className="size-4" />}
          </button>
        </div>
      </header>

      <StakePicker game="INFILTRADO" stake={state.stake} players={state.seats.filter((s) => s && !s.bot).length} editable={isHost} onChange={actions.setStake} className="mx-3" cpu={state.seats.filter((s) => s?.bot).length} />

      <div className="flex flex-1 flex-col gap-3 p-3 lg:flex-row">
        <ul className="grid flex-1 grid-cols-3 content-start gap-2 sm:grid-cols-5" aria-label={`Jogadores: ${players} de ${INF_SEATS}`}>
          {Array.from({ length: INF_SEATS }, (_, seat) => (
            <SeatCard key={seat} state={state} seat={seat} mySeat={mySeat} actions={actions} />
          ))}
        </ul>

        <section aria-label="Regras da partida" className="glass flex flex-col gap-3 rounded-2xl p-4 lg:w-80">
          <h2 className="font-display text-lg font-semibold">Regras {!isHost && <span className="text-xs font-normal text-slate-400">(o anfitrião escolhe)</span>}</h2>
          <Choice label="Infiltrados" field="impostors" options={[1, 2, 3]} state={state} disabled={!isHost} onChange={setRules} />
          {effectiveImpostors < state.rules.impostors && (
            <p className="-mt-2 text-xs text-amber-300">
              Com {players} jogadores entram {effectiveImpostors}.
            </p>
          )}
          <Choice label="Recarga para eliminar" field="killCooldown" options={[20, 30, 45, 60]} state={state} disabled={!isHost} onChange={setRules} format={secs} />
          <Choice label="Discussão" field="discussionTime" options={[0, 15, 30, 60, 90]} state={state} disabled={!isHost} onChange={setRules} format={secs} />
          <Choice label="Votação" field="votingTime" options={[30, 60, 90, 120]} state={state} disabled={!isHost} onChange={setRules} format={secs} />
          <Choice label="Tarefas por tripulante" field="tasks" options={[3, 4, 5, 6, 7]} state={state} disabled={!isHost} onChange={setRules} />
          <Choice label="Reuniões de emergência" field="emergencyMeetings" options={[1, 2, 3]} state={state} disabled={!isHost} onChange={setRules} />
          <Choice label="Revelar quem foi ejetado" field="confirmEjects" options={[true, false]} state={state} disabled={!isHost} onChange={setRules} format={(v) => (v ? 'Sim' : 'Não')} />
        </section>
      </div>

      <section
        aria-label="Partida"
        className="sticky bottom-0 flex flex-wrap items-center justify-center gap-2 border-t border-cyan-200/10 bg-[#03101c]/95 px-3 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] backdrop-blur"
      >
        <p className="w-full text-center text-xs text-slate-300">
          {players < INF_MIN_PLAYERS
            ? isHost
              ? `Mínimo ${INF_MIN_PLAYERS} jogadores: chame amigos ou adicione CPU`
              : 'Esperando mais jogadores…'
            : canStart
              ? isHost
                ? 'Tudo pronto! Toque em INICIAR'
                : 'Tudo pronto! Esperando o anfitrião'
              : 'Escolha sua cor e confirme que está pronto'}
        </p>
        {isHost && (
          <Button variant="secondary" className="h-11 gap-1 rounded-xl" onClick={() => void actions.setVisibility(!state.isPublic)}>
            {state.isPublic ? <Globe aria-hidden /> : <Lock aria-hidden />}
            {state.isPublic ? 'Pública' : 'Privada'}
          </Button>
        )}
        {me && !me.bot && (
          <Button
            variant="secondary"
            aria-pressed={me.ready}
            className={cn('h-11 gap-1 rounded-xl', me.ready && 'bg-emerald-400 text-emerald-950 hover:bg-emerald-300')}
            disabled={busy}
            onClick={run(() => actions.ready(!me.ready))}
          >
            <Check aria-hidden /> {me.ready ? 'Pronto!' : 'Estou pronto'}
          </Button>
        )}
        {isHost && (
          <Button className="h-11 gap-1 rounded-xl bg-cyan-400 px-5 font-black text-slate-950 hover:bg-cyan-300" disabled={busy || !canStart} onClick={run(actions.start)}>
            <Play aria-hidden className="fill-current" /> INICIAR
          </Button>
        )}
      </section>
    </main>
  );
}

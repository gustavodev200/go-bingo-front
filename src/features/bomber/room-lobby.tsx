'use client';

import { Bot, Check, ChevronLeft, ChevronRight, Copy, Crown, Globe, Lock, Play, Share2, WifiOff, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { BOMBER_COLORS, BOMBER_SEATS, type BomberRoomState, type BomberSeatPlayer } from '@/contracts';
import { Button } from '@/components/ui/button';
import { StakePicker } from '@/features/arena/stake-picker';
import { useBusy } from '@/features/truco/action-bar';
import { useSecondsLeft } from '@/features/truco/seat-badge';
import { cn } from '@/lib/utils';
import type { BomberActions } from './connection';
import { drawPortrait } from './media/sprites';

const WINS_OPTIONS = [1, 2, 3, 4, 5] as const;

/** Next color nobody else picked, walking `step` (±1) from the current one. */
export function nextFreeColor(state: BomberRoomState, mySeat: number, step: 1 | -1): number | null {
  const mine = state.seats[mySeat]?.color ?? 0;
  const taken = new Set(state.seats.filter((s, i) => s && i !== mySeat).map((s) => s!.color));
  const n = BOMBER_COLORS.length;
  for (let i = 1; i < n; i++) {
    const c = (((mine + step * i) % n) + n) % n;
    if (!taken.has(c)) return c;
  }
  return null;
}

/** Idle bomber in its color, bobbing like the character select of the console games. */
export function Portrait({ color, className }: { color: number; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv || !cv.getContext('2d')) return;
    const draw = () => drawPortrait(cv, color, performance.now() / 1000);
    draw();
    const id = setInterval(draw, 160);
    return () => clearInterval(id);
  }, [color]);
  return <canvas ref={ref} width={96} height={120} aria-hidden className={cn('[image-rendering:pixelated]', className)} />;
}

function SeatCard({ state, seat, mySeat, actions }: { state: BomberRoomState; seat: number; mySeat: number; actions: BomberActions }) {
  const player: BomberSeatPlayer | null = state.seats[seat];
  const seconds = useSecondsLeft(player?.reconnectDeadline ?? null);
  const isHost = state.hostId === state.seats[mySeat]?.userId;
  const badge = (
    <span aria-hidden className="absolute top-2 left-2 rounded-full border-2 border-sky-500 bg-white px-2 text-xs font-black text-sky-600">
      {seat + 1}P
    </span>
  );

  if (!player)
    return (
      <li className="relative flex min-h-36 flex-col items-center justify-center gap-2 rounded-2xl border-[3px] border-dashed border-black/25 bg-white/40 p-3">
        {badge}
        {isHost ? (
          <Button size="sm" variant="secondary" className="gap-1 rounded-xl border-2 border-black/70 bg-white font-bold text-slate-900 shadow-[0_3px_0_rgb(0_0_0/0.6)] hover:bg-amber-100" onClick={() => void actions.addBot()}>
            <Bot aria-hidden className="size-4" /> + CPU
          </Button>
        ) : (
          <span className="text-sm font-bold text-black/50">Aguardando…</span>
        )}
      </li>
    );

  const color = BOMBER_COLORS[player.color] ?? BOMBER_COLORS[0];
  const mine = seat === mySeat;
  const step = (dir: 1 | -1) => {
    const next = nextFreeColor(state, mySeat, dir);
    if (next !== null) void actions.setColor(next);
  };
  return (
    <li
      aria-label={`${player.nickname}, ${color.name}${player.ready ? ', pronto' : ''}`}
      className={cn('relative flex min-h-36 flex-col items-center justify-end overflow-hidden rounded-2xl border-[3px] text-slate-900 shadow-[0_4px_0_rgb(0_0_0/0.25)]', mine ? 'border-white ring-4 ring-amber-400' : 'border-black/10', !player.connected && 'opacity-60')}
      style={{ background: `repeating-linear-gradient(0deg, rgb(255 255 255 / 0.35) 0 2px, transparent 2px 6px), ${color.card}` }}
    >
      {badge}
      <span className="absolute top-2 right-2 flex flex-wrap justify-end gap-1">
        {player.userId === state.hostId && <Crown aria-label="Anfitrião" className="size-5 fill-amber-300 text-amber-600" />}
        {player.bot && <span className="rounded-md border-2 border-black/70 bg-slate-200 px-1.5 text-[10px] font-black">CPU</span>}
        {mine && <span className="rounded-md border-2 border-black/70 bg-red-500 px-1.5 text-[10px] font-black text-white">VOCÊ</span>}
      </span>
      {isHost && player.bot && (
        <button type="button" aria-label={`Tirar ${player.nickname}`} onClick={() => void actions.removeBot(seat)} className="absolute top-8 right-2 grid size-7 place-items-center rounded-full border-2 border-black/70 bg-white">
          <X aria-hidden className="size-4" />
        </button>
      )}
      <Portrait color={player.color} className="mt-7 h-24 w-20 sm:h-28 sm:w-24" />
      <div className="flex w-full items-center justify-between gap-1 border-t-[3px] border-black/10 bg-white px-1 py-1.5">
        {mine ? (
          <button type="button" aria-label="Cor anterior" onClick={() => step(-1)} className="grid size-9 place-items-center text-red-500">
            <ChevronLeft aria-hidden className="size-6 stroke-3" />
          </button>
        ) : (
          <span className="size-9" />
        )}
        <span className="flex min-w-0 flex-1 flex-col items-center leading-tight">
          <b className="max-w-full truncate text-sm">{player.nickname}</b>
          {player.connected ? (
            <span className={cn('flex items-center gap-0.5 text-[11px] font-bold', player.ready ? 'text-emerald-600' : 'text-slate-500')}>
              {player.ready && <Check aria-hidden className="size-3" />}
              {player.ready ? 'Pronto' : color.name}
            </span>
          ) : (
            <span className="flex items-center gap-0.5 text-[11px] font-bold text-amber-700">
              <WifiOff aria-hidden className="size-3" /> {seconds}s
            </span>
          )}
        </span>
        {mine ? (
          <button type="button" aria-label="Próxima cor" onClick={() => step(1)} className="grid size-9 place-items-center text-red-500">
            <ChevronRight aria-hidden className="size-6 stroke-3" />
          </button>
        ) : (
          <span className="size-9" />
        )}
      </div>
    </li>
  );
}

/** Waiting room styled after the console character select: pick a color, call CPUs, get ready. */
export function RoomLobby({ state, mySeat, actions }: { state: BomberRoomState; mySeat: number; actions: BomberActions }) {
  const { busy, run } = useBusy();
  const me = state.seats[mySeat];
  const isHost = state.hostId === me?.userId;
  const players = state.seats.filter(Boolean).length;
  const canStart = state.lobbyStatus === 'READY_TO_START';

  async function share() {
    const url = `${window.location.origin}/bomber/${state.code}`;
    try {
      if (navigator.share) await navigator.share({ title: 'Bomberman', text: `Bora uma batalha! Sala ${state.code}`, url });
      else {
        await navigator.clipboard.writeText(url);
        toast.success('Link copiado!');
      }
    } catch {
      /* share sheet closed */
    }
  }

  return (
    <main className="flex min-h-dvh flex-col bg-[repeating-linear-gradient(135deg,rgb(255_255_255/0.16)_0_18px,transparent_18px_36px),conic-gradient(#facc15_25%,#f59e0b_0_50%,#facc15_0_75%,#f59e0b_0)] bg-size-[auto,56px_56px]">
      <header className="flex items-center gap-3 border-b-4 border-black bg-[repeating-linear-gradient(120deg,rgb(255_255_255/0.05)_0_10px,transparent_10px_20px),#2b2b33] px-3 pt-[calc(0.5rem+env(safe-area-inset-top))] pb-2 text-white">
        <Button variant="ghost" size="icon" aria-label="Sair da sala" className="size-11 shrink-0 rounded-full border-2 border-white" disabled={busy} onClick={run(actions.leave)}>
          <ChevronLeft aria-hidden />
        </Button>
        <h1 className="font-display flex-1 truncate text-xl font-bold tracking-wide sm:text-3xl">BATALHA MULTIPLAYER</h1>
        <div className="flex items-center gap-1 rounded-full border-[3px] border-red-500 bg-white py-1 pr-1 pl-3 text-slate-900">
          <span className="sr-only">Código da sala</span>
          <b className="font-mono text-base tracking-[0.2em] sm:text-lg">{state.code}</b>
          <button type="button" aria-label="Compartilhar sala" onClick={() => void share()} className="grid size-8 place-items-center rounded-full bg-slate-100">
            {typeof navigator !== 'undefined' && 'share' in navigator ? <Share2 aria-hidden className="size-4" /> : <Copy aria-hidden className="size-4" />}
          </button>
        </div>
      </header>

      <StakePicker game="BOMBER" stake={state.stake} players={state.seats.filter((s) => s && !s.bot).length} editable={isHost} onChange={actions.setStake} variant="light" className="mx-3 mt-3" />

      <ul className="grid flex-1 grid-cols-2 content-start gap-2.5 p-3 sm:grid-cols-4 sm:gap-4 sm:p-5" aria-label="Jogadores">
        {Array.from({ length: BOMBER_SEATS }, (_, seat) => (
          <SeatCard key={seat} state={state} seat={seat} mySeat={mySeat} actions={actions} />
        ))}
      </ul>

      <section aria-label="Partida" className="flex flex-wrap items-center justify-center gap-2 px-3 pb-3 text-slate-900">
        <fieldset className="flex items-center gap-1 rounded-xl border-[3px] border-black bg-white px-2 py-1" disabled={!isHost}>
          <legend className="sr-only">Vitórias para ser campeão</legend>
          <span className="pr-1 text-xs font-black">Vitórias</span>
          {WINS_OPTIONS.map((w) => (
            <label key={w} className="grid size-8 cursor-pointer place-items-center rounded-lg text-sm font-black has-checked:bg-amber-400 has-disabled:cursor-default">
              <input type="radio" name="bomber-wins" className="sr-only" checked={state.rules.winsToWin === w} onChange={() => void actions.setRules({ winsToWin: w })} />
              {w}
            </label>
          ))}
        </fieldset>
        {isHost && (
          <Button variant="secondary" className="h-11 gap-1 rounded-xl border-[3px] border-black bg-white font-black text-slate-900" onClick={() => void actions.setVisibility(!state.isPublic)}>
            {state.isPublic ? <Globe aria-hidden /> : <Lock aria-hidden />}
            {state.isPublic ? 'Pública' : 'Privada'}
          </Button>
        )}
        {me && !me.bot && (
          <Button
            variant="secondary"
            aria-pressed={me.ready}
            className={cn('h-11 gap-1 rounded-xl border-[3px] border-black font-black', me.ready ? 'bg-emerald-400 text-emerald-950 hover:bg-emerald-300' : 'bg-white text-slate-900')}
            disabled={busy}
            onClick={run(() => actions.ready(!me.ready))}
          >
            <Check aria-hidden /> {me.ready ? 'Pronto!' : 'Estou pronto'}
          </Button>
        )}
        {isHost && (
          <Button className="h-11 gap-1 rounded-xl border-[3px] border-black bg-red-500 px-5 font-black text-white shadow-[0_4px_0_#000] hover:bg-red-400" disabled={busy || !canStart} onClick={run(actions.start)}>
            <Play aria-hidden className="fill-current" /> INICIAR
          </Button>
        )}
      </section>

      <footer className="border-t-4 border-black bg-[#2b2b33] px-3 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] text-center text-sm font-bold text-white">
        {players < 2 ? (isHost ? 'Chame alguém ou adicione CPU para começar' : 'Esperando mais jogadores…') : canStart ? (isHost ? 'Tudo pronto! Toque em INICIAR' : 'Tudo pronto! Esperando o anfitrião') : 'Escolha seu personagem e confirme que está pronto'}
      </footer>
    </main>
  );
}

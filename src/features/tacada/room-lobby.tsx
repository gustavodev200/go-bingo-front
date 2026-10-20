'use client';

import { AddCpuButton, CpuTag, RemoveCpuButton } from '@/features/arena/cpu';
import { StakePicker } from '@/features/arena/stake-picker';
import { Check, ChevronLeft, Copy, Crown, Globe, Loader2, Lock, Share2, WifiOff } from 'lucide-react';
import { toast } from 'sonner';
import { TACADA_AIM_GUIDES, TACADA_SEATS, TACADA_SHOT_SECONDS, type TacadaRoomState, type TacadaRules } from '@/contracts';
import { Avatar } from '@/components/stage/avatar';
import { Button } from '@/components/ui/button';
import { useBusy } from '@/features/truco/action-bar';
import { useSecondsLeft } from '@/features/truco/seat-badge';
import { cn } from '@/lib/utils';
import type { TacadaActions } from './connection';
import { shotLabel } from './rules-view';
import { MiniBall } from './mini-ball';

const SHOT_HINT: Record<number, string> = { 20: 'Relâmpago', 30: 'Normal', 45: 'Com calma' };
const GUIDE_LABEL: Record<TacadaRules['aimGuide'], { label: string; hint: string }> = {
  long: { label: 'Mira longa', hint: 'Mostra o caminho das bolas' },
  short: { label: 'Mira curta', hint: 'Só a bola fantasma: pra quem manja' },
};

function SeatCard({ state, seat, mySeat, actions }: { state: TacadaRoomState; seat: number; mySeat: number; actions: TacadaActions }) {
  const player = state.seats[seat];
  const seconds = useSecondsLeft(player?.reconnectDeadline ?? null);
  const isHost = state.hostId === state.seats[mySeat]?.userId;
  if (!player)
    return (
      <li className="flex min-h-28 flex-col items-center justify-center gap-1 rounded-3xl border-2 border-dashed border-white/20 p-3 text-center">
        <span className="text-xs font-semibold text-white/60">Esperando adversário</span>
        <span className="text-[11px] text-white/50">Mande o código ou o link</span>
        {isHost && <AddCpuButton onAdd={actions.addBot} />}
      </li>
    );
  return (
    <li
      className={cn('relative flex min-h-28 flex-col items-center gap-1.5 rounded-3xl bg-white/10 p-3 ring-2', seat === mySeat ? 'ring-amber-300' : 'ring-white/20', !player.connected && 'opacity-60')}
      aria-label={`${player.nickname}${player.ready ? ', pronto' : ''}`}
    >
      {player.userId === state.hostId && <Crown aria-label="Anfitrião" className="absolute top-2 left-2 size-4 fill-amber-300 text-amber-500" />}
      {player.bot && <CpuTag className="absolute top-2 left-2" />}
      {player.bot && isHost && <RemoveCpuButton name={player.nickname} onRemove={() => actions.removeBot(seat)} className="absolute right-1.5 bottom-1.5" />}
      {state.breakerSeat === seat && (
        <span className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-black/40 px-1.5 py-0.5 text-[10px] font-bold text-amber-200" title="Dá a saída">
          <MiniBall n={0} /> Saída
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

function RulesForm({ rules, editable, onChange }: { rules: TacadaRules; editable: boolean; onChange(next: TacadaRules): void }) {
  return (
    <section className="glass flex flex-col gap-3 p-4" aria-labelledby="tacada-rules-title">
      <h2 id="tacada-rules-title" className="font-display text-lg font-semibold">
        Regras da mesa {!editable && <span className="text-xs font-normal text-white/70">(o anfitrião escolhe)</span>}
      </h2>
      <fieldset className="flex flex-col gap-2" disabled={!editable}>
        <legend className="mb-1 text-sm font-medium">Tempo por tacada</legend>
        <div className="grid grid-cols-3 gap-2">
          {TACADA_SHOT_SECONDS.map((shotSeconds) => (
            <label
              key={shotSeconds}
              className="flex min-h-11 cursor-pointer flex-col justify-center rounded-xl border border-white/15 px-2 py-2 text-center has-checked:border-amber-300/70 has-checked:bg-amber-300/15 has-disabled:cursor-default"
            >
              <input type="radio" name="tacada-shot" className="sr-only" checked={rules.shotSeconds === shotSeconds} onChange={() => onChange({ ...rules, shotSeconds })} />
              <span className="text-sm leading-tight font-semibold">{shotLabel(shotSeconds)}</span>
              <span className="text-[11px] leading-tight text-white/70">{SHOT_HINT[shotSeconds]}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="flex flex-col gap-2" disabled={!editable}>
        <legend className="mb-1 text-sm font-medium">Mira</legend>
        <div className="grid grid-cols-2 gap-2">
          {TACADA_AIM_GUIDES.map((aimGuide) => (
            <label
              key={aimGuide}
              className="flex min-h-11 cursor-pointer flex-col justify-center rounded-xl border border-white/15 px-2 py-2 text-center has-checked:border-amber-300/70 has-checked:bg-amber-300/15 has-disabled:cursor-default"
            >
              <input type="radio" name="tacada-guide" className="sr-only" checked={rules.aimGuide === aimGuide} onChange={() => onChange({ ...rules, aimGuide })} />
              <span className="text-sm leading-tight font-semibold">{GUIDE_LABEL[aimGuide].label}</span>
              <span className="text-[11px] leading-tight text-white/70">{GUIDE_LABEL[aimGuide].hint}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <p className="text-xs text-white/70">Regras da casa: cante a caçapa da 8, a 8 na saída volta pra mesa e 3 faltas seguidas perdem.</p>
    </section>
  );
}

export function RoomLobby({ state, mySeat, actions }: { state: TacadaRoomState; mySeat: number; actions: TacadaActions }) {
  const { busy, run } = useBusy();
  const me = state.seats[mySeat]!;
  const isHost = state.hostId === me.userId;
  const seated = state.seats.filter(Boolean).length;
  const canStart = isHost && state.lobbyStatus === 'READY_TO_START';

  async function share() {
    const url = `${window.location.origin}/tacada/${state.code}`;
    if (navigator.share) {
      await navigator.share({ title: 'Tacada', text: `Bora uma sinuca na Tacada? Mesa ${state.code}`, url }).catch(() => undefined);
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
        <h1 className="font-display text-marquee text-2xl font-bold">Tacada</h1>
        <span className="text-sm font-semibold text-violet-200" role="status">
          {seated}/{TACADA_SEATS} na mesa
        </span>
      </header>

      <StakePicker game="TACADA" stake={state.stake} players={seated} editable={isHost} onChange={actions.setStake} cpu={state.seats.filter((s) => s?.bot).length} />

      <section className="flex items-center justify-between gap-3 rounded-2xl bg-white/5 px-4 py-2 ring-1 ring-white/10" aria-label="Visibilidade">
        <span className="flex items-center gap-2 text-sm">
          {state.isPublic ? <Globe aria-hidden className="size-4 text-emerald-300" /> : <Lock aria-hidden className="size-4 text-amber-300" />}
          <span>
            <strong>{state.isPublic ? 'Mesa pública' : 'Mesa privada'}</strong>
            <span className="text-violet-200/80"> · {state.isPublic ? 'aparece na lista da Tacada' : 'só entra quem tem o código'}</span>
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
            <SeatCard key={seat} state={state} seat={seat} mySeat={mySeat} actions={actions} />
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
        {isHost && !canStart && <p className="text-center text-xs text-violet-200/80">A partida começa com os {TACADA_SEATS} jogadores conectados e prontos. A saída alterna a cada revanche.</p>}
      </section>

      <nav className="flex items-center text-sm">
        <Button variant="ghost" className="h-11 gap-1 rounded-xl text-violet-200" disabled={busy} onClick={run(actions.leave)}>
          <ChevronLeft aria-hidden className="size-4" /> Sair da mesa
        </Button>
      </nav>
    </main>
  );
}

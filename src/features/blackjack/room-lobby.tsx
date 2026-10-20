'use client';

import { StakePicker } from '@/features/arena/stake-picker';
import { Check, ChevronLeft, Copy, Crown, Globe, Loader2, Lock, Share2, WifiOff } from 'lucide-react';
import { toast } from 'sonner';
import { BJ_DECKS, BJ_PAYOUTS, BJ_ROUNDS, BJ_SEATS, BJ_START_CHIPS, BJ_TURN_SECONDS, type BjRoomState, type BjRules } from '@/contracts';
import { Avatar } from '@/components/stage/avatar';
import { Button } from '@/components/ui/button';
import { useBusy } from '@/features/truco/action-bar';
import { useSecondsLeft } from '@/features/truco/seat-badge';
import { cn } from '@/lib/utils';
import type { BjActions } from './connection';
import { fmtChips } from './rules-view';

function SeatCard({ state, seat, mySeat }: { state: BjRoomState; seat: number; mySeat: number }) {
  const player = state.seats[seat];
  const seconds = useSecondsLeft(player?.reconnectDeadline ?? null);
  if (!player)
    return (
      <li className="flex min-h-28 flex-col items-center justify-center rounded-3xl border-2 border-dashed border-white/20 p-3 text-center">
        <span className="text-xs font-semibold text-white/60">Lugar livre</span>
        <span className="text-[11px] text-white/50">Mande o código ou o link</span>
      </li>
    );
  return (
    <li
      className={cn('relative flex min-h-28 flex-col items-center gap-1.5 rounded-3xl bg-white/10 p-3 ring-2', seat === mySeat ? 'ring-amber-300' : 'ring-white/20', !player.connected && 'opacity-60')}
      aria-label={`${player.nickname}${player.ready ? ', pronto' : ''}`}
    >
      {player.userId === state.hostId && <Crown aria-label="Anfitrião" className="absolute top-2 left-2 size-4 fill-amber-300 text-amber-500" />}
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

/** One row of radio "pills" for a rule. */
function Choice<T extends string | number>({
  legend,
  name,
  options,
  value,
  label,
  hint,
  onChange,
}: {
  legend: string;
  name: string;
  options: readonly T[];
  value: T;
  label(v: T): string;
  hint?(v: T): string;
  onChange(v: T): void;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-medium">{legend}</legend>
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
        {options.map((option) => (
          <label
            key={option}
            className="flex min-h-11 cursor-pointer flex-col justify-center rounded-xl border border-white/15 px-2 py-2 text-center has-checked:border-emerald-300/70 has-checked:bg-emerald-300/15 has-disabled:cursor-default"
          >
            <input type="radio" name={name} className="sr-only" checked={value === option} onChange={() => onChange(option)} />
            <span className="text-sm leading-tight font-semibold">{label(option)}</span>
            {hint && <span className="text-[11px] leading-tight text-white/70">{hint(option)}</span>}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

const ROUNDS_HINT: Record<number, string> = { 5: 'Rápida', 10: 'Normal', 15: 'Longa' };

function RulesForm({ rules, editable, onChange }: { rules: BjRules; editable: boolean; onChange(next: BjRules): void }) {
  return (
    <section className="glass flex flex-col gap-3 p-4" aria-labelledby="bj-rules-title">
      <h2 id="bj-rules-title" className="font-display text-lg font-semibold">
        Regras da mesa {!editable && <span className="text-xs font-normal text-white/70">(o anfitrião escolhe)</span>}
      </h2>
      <fieldset className="flex flex-col gap-3" disabled={!editable}>
        <Choice legend="Rodadas" name="bj-rounds" options={BJ_ROUNDS} value={rules.rounds} label={(v) => `${v}`} hint={(v) => ROUNDS_HINT[v]} onChange={(rounds) => onChange({ ...rules, rounds })} />
        <Choice
          legend="Blackjack paga"
          name="bj-payout"
          options={BJ_PAYOUTS}
          value={rules.payout}
          label={(v) => v.replace(':', ' para ')}
          hint={(v) => (v === '3:2' ? 'Clássico' : 'Mais difícil')}
          onChange={(payout) => onChange({ ...rules, payout })}
        />
        <Choice
          legend="Baralhos no sapato"
          name="bj-decks"
          options={BJ_DECKS}
          value={rules.decks}
          label={(v) => `${v} baralhos`}
          hint={(v) => (v === 2 ? 'Double Deck, sem render' : 'Com render')}
          onChange={(decks) => onChange({ ...rules, decks })}
        />
        <Choice
          legend="Tempo por decisão"
          name="bj-turn"
          options={BJ_TURN_SECONDS}
          value={rules.turnSeconds}
          label={(v) => `${v} s`}
          hint={(v) => (v === 15 ? 'Ágil' : 'Com calma')}
          onChange={(turnSeconds) => onChange({ ...rules, turnSeconds })}
        />
      </fieldset>
      <p className="text-xs text-white/70">Cada um começa com {fmtChips(BJ_START_CHIPS)} fichas. Dealer para em 17, seguro paga 2 para 1, divide uma vez.</p>
    </section>
  );
}

export function RoomLobby({ state, mySeat, actions }: { state: BjRoomState; mySeat: number; actions: BjActions }) {
  const { busy, run } = useBusy();
  const me = state.seats[mySeat]!;
  const isHost = state.hostId === me.userId;
  const seated = state.seats.filter(Boolean).length;
  const canStart = isHost && state.lobbyStatus === 'READY_TO_START';

  async function share() {
    const url = `${window.location.origin}/blackjack/${state.code}`;
    if (navigator.share) {
      await navigator.share({ title: 'Blackjack', text: `Bora um blackjack? Mesa ${state.code}`, url }).catch(() => undefined);
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
        <h1 className="font-display text-marquee text-2xl font-bold">Blackjack</h1>
        <span className="text-sm font-semibold text-violet-200" role="status">
          {seated}/{BJ_SEATS} na mesa
        </span>
      </header>

      <StakePicker game="BLACKJACK" stake={state.stake} players={seated} editable={isHost} onChange={actions.setStake} />

      <section className="flex items-center justify-between gap-3 rounded-2xl bg-white/5 px-4 py-2 ring-1 ring-white/10" aria-label="Visibilidade">
        <span className="flex items-center gap-2 text-sm">
          {state.isPublic ? <Globe aria-hidden className="size-4 text-emerald-300" /> : <Lock aria-hidden className="size-4 text-amber-300" />}
          <span>
            <strong>{state.isPublic ? 'Mesa pública' : 'Mesa privada'}</strong>
            <span className="text-violet-200/80"> · {state.isPublic ? 'aparece na lista do blackjack' : 'só entra quem tem o código'}</span>
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
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
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
            {seated === 1 ? 'Treinar contra o dealer' : 'Começar partida'}
          </Button>
        ) : (
          <p className="text-center text-sm text-violet-200" role="status">
            {state.lobbyStatus === 'READY_TO_START' ? 'Tudo pronto! Esperando o anfitrião começar.' : 'Esperando todo mundo ficar pronto…'}
          </p>
        )}
        {isHost && !canStart && (
          <p className="text-center text-xs text-violet-200/80">
            {seated === 1 ? 'Sozinho é treino contra o dealer (não vale na Arena). Com 2 ou mais, vence quem terminar com mais fichas.' : 'A partida começa com todo mundo conectado e pronto.'}
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

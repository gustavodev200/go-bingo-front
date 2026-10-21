'use client';

import { Crown, WifiOff } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { GAUD_CALL_LABEL, type GaudMatchView, type GaudRoomState, type GaudSeat, type GaudSeatPlayer, type GaudTeam } from '@/contracts';
import { Avatar } from '@/components/stage/avatar';
import { TEAM_TONE, useSecondsLeft } from '@/features/truco/seat-badge';
import trucoStyles from '@/features/truco/truco.module.css';
import { cn } from '@/lib/utils';
import { SpanishCard } from './spanish-card';
import { useGaudStore, type GaudEffect, type ShoutTone } from './store';
import { describeSide, positionOf, TRUCO_VALUE_NAME, visibleRound, type TablePosition } from './view';

// ---------------------------------------------------------------------------
// Lugar de um adversário/parceiro na mesa
// ---------------------------------------------------------------------------

export function SeatBadge({
  player,
  position,
  ours,
  isTurn,
  isMano,
  isHost,
  cardsLeft,
}: {
  player: GaudSeatPlayer;
  position: TablePosition;
  ours: boolean;
  isTurn: boolean;
  isMano: boolean;
  isHost: boolean;
  cardsLeft: number;
}) {
  const tone = TEAM_TONE[ours ? 'us' : 'them'];
  const seconds = useSecondsLeft(player.reconnectDeadline);
  const vertical = position === 'left' || position === 'right';
  return (
    <div className={cn('flex items-center gap-1.5', vertical ? 'flex-col' : 'flex-row')} data-position={position}>
      <div className="relative flex flex-col items-center gap-1">
        <div className={cn('relative rounded-full p-0.5 ring-3', tone.ring, isTurn && trucoStyles.turn, !player.connected && 'opacity-50 grayscale')}>
          <div className="flex size-[clamp(42px,min(14vw,10dvh),72px)] items-end justify-center overflow-hidden rounded-full bg-violet-950/70">
            <Avatar id={player.userId} character={player.character} className="w-[85%] translate-y-[6%]" />
          </div>
          {isHost && <Crown aria-label="Anfitrião" className="absolute -top-2 -left-1 size-4 fill-amber-300 text-amber-500" />}
          {isMano && (
            <span
              title="É mão (começa a mão e desempata)"
              className="absolute -right-1 -bottom-1 flex size-5 items-center justify-center rounded-full bg-white text-[10px] font-black text-slate-900 shadow"
            >
              M
            </span>
          )}
        </div>
        <span className={cn('max-w-[6.5rem] truncate rounded-full px-2 py-0.5 text-xs font-semibold backdrop-blur', tone.bg, tone.text)}>{player.nickname}</span>
        {!player.connected && (
          <span role="status" className="flex items-center gap-1 rounded-full bg-amber-500/90 px-2 py-0.5 text-[10px] font-bold text-black">
            <WifiOff aria-hidden className="size-3" />
            Reconectando{seconds !== null ? ` ${seconds}s` : '…'}
          </span>
        )}
      </div>
      {cardsLeft > 0 && (
        <div aria-label={`${cardsLeft} cartas na mão`} className="flex -space-x-[45%]">
          {Array.from({ length: cardsLeft }, (_, i) => (
            <SpanishCard key={i} card={null} size="xs" style={{ rotate: `${(i - (cardsLeft - 1) / 2) * 12}deg` }} />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cartas da rodada no meio da mesa
// ---------------------------------------------------------------------------

const SLOT: Record<TablePosition, string> = {
  bottom: 'left-1/2 top-[58%] -translate-x-1/2',
  top: 'left-1/2 top-[12%] -translate-x-1/2',
  left: 'left-[16%] top-1/2 -translate-y-1/2 -rotate-6',
  right: 'right-[16%] top-1/2 -translate-y-1/2 rotate-6',
};
const ENTER: Record<TablePosition, string> = { bottom: trucoStyles.fromBottom, top: trucoStyles.fromTop, left: trucoStyles.fromLeft, right: trucoStyles.fromRight };

export function TableCenter({ state, mySeat }: { state: GaudRoomState; mySeat: GaudSeat }) {
  const shown = visibleRound(state);
  const size = state.settings.size;
  return (
    <div className="absolute inset-[18%_14%] sm:inset-[16%_20%]" aria-label="Mesa">
      {shown && (
        <p className="sr-only" aria-live="polite">
          Rodada {shown.number}: {shown.round.plays.length} cartas na mesa
        </p>
      )}
      {shown?.round.plays.map((p) => {
        const pos = positionOf(p.seat, mySeat, size);
        const winner = shown.round.result !== null && shown.round.result !== 'tie' && shown.round.winningSeat === p.seat;
        return (
          <div key={`${shown.number}-${p.seat}`} className={cn('absolute', SLOT[pos])}>
            <div className={ENTER[pos]}>
              <SpanishCard card={p.card} size="md" highlight={winner} dim={shown.round.result !== null && !winner && shown.round.result !== 'tie'} />
            </div>
          </div>
        );
      })}
      {shown?.round.result === 'tie' && <span className="absolute top-1/2 left-1/2 -translate-1/2 rounded-full bg-black/60 px-3 py-1 text-sm font-black text-white">Parda!</span>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Placar
// ---------------------------------------------------------------------------

export function Scoreboard({ scores, myTeam, match, target, solo }: { scores: [number, number]; myTeam: GaudTeam; match: GaudMatchView | null; target: number; solo: boolean }) {
  const them = (1 - myTeam) as GaudTeam;
  const rounds = match?.rounds ?? [];
  const lastSide = match?.sideResults[match.sideResults.length - 1];
  return (
    <div role="group" aria-label="Placar" className="flex min-w-0 flex-1 items-stretch overflow-hidden rounded-2xl border border-white/10 bg-violet-950/70 text-center shadow-lg backdrop-blur">
      <div className="flex w-[4.5rem] flex-col justify-center bg-emerald-500/25 px-2 py-1 sm:w-24">
        <span className="text-[10px] font-bold tracking-widest text-emerald-200 uppercase">{solo ? 'Você' : 'Nós'}</span>
        <span aria-label={`${solo ? 'Você' : 'Nós'}: ${scores[myTeam]} pontos`} className="font-display text-2xl leading-none font-black text-white tabular-nums sm:text-3xl">
          {scores[myTeam]}
        </span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col items-center justify-center gap-1 px-2 py-1">
        <span className="text-[10px] font-semibold tracking-widest text-violet-200 uppercase">Até {target}</span>
        <div className="flex items-center gap-1.5" aria-label="Rodadas da mão">
          {[0, 1, 2].map((i) => {
            const r = rounds[i]?.result ?? null;
            return (
              <span
                key={i}
                title={r === null ? `Rodada ${i + 1}` : r === 'tie' ? 'Parda' : r === myTeam ? 'Nossa' : 'Deles'}
                className={cn(
                  'size-3 rounded-full ring-1 ring-white/30',
                  r === null ? 'bg-white/15' : r === 'tie' ? 'bg-slate-300' : r === myTeam ? 'bg-emerald-400' : 'bg-rose-400',
                  match && rounds.length - 1 === i && r === null && 'ring-2 ring-amber-300',
                )}
              />
            );
          })}
        </div>
        {match && (
          <span className="truncate text-[11px] font-bold text-amber-200">
            {TRUCO_VALUE_NAME[match.trucoValue]} · vale {match.trucoValue}
            {lastSide && ` · ${lastSide.kind === 'flor' ? 'Flor' : 'Envido'} ${lastSide.winnerTeam === myTeam ? '+' : '−'}${lastSide.points}`}
          </span>
        )}
      </div>
      <div className="flex w-[4.5rem] flex-col justify-center bg-rose-500/25 px-2 py-1 sm:w-24">
        <span className="text-[10px] font-bold tracking-widest text-rose-200 uppercase">Eles</span>
        <span aria-label={`Eles: ${scores[them]} pontos`} className="font-display text-2xl leading-none font-black text-white tabular-nums sm:text-3xl">
          {scores[them]}
        </span>
      </div>
    </div>
  );
}

/** Faixa com o canto que espera resposta ("Envido · Real Envido"). */
export function PendingStrip({ match }: { match: GaudMatchView }) {
  if (!match.pending) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-[3%] z-10 flex justify-center px-2">
      <span className="rounded-full bg-amber-300/95 px-3 py-1 text-xs font-black tracking-wide text-amber-950 uppercase shadow">
        {match.pending.chain.map((c) => GAUD_CALL_LABEL[c]).join(' → ')}
        {match.trucoOnHold && ' · truco esperando'}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Gritos e faixas
// ---------------------------------------------------------------------------

const LIFETIME: Record<GaudEffect['kind'], number> = { shout: 1_700, banner: 2_600, side: 5_500, say: 4_500 };

/** Tira cada efeito visual depois da animação, para o store nunca crescer. */
export function useEffectsExpiry() {
  const effects = useGaudStore((s) => s.effects);
  const scheduled = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  useEffect(() => {
    for (const e of effects) {
      if (scheduled.current.has(e.id)) continue;
      scheduled.current.set(
        e.id,
        setTimeout(() => {
          scheduled.current.delete(e.id);
          useGaudStore.getState().removeEffect(e.id);
        }, LIFETIME[e.kind]),
      );
    }
  }, [effects]);
  useEffect(() => {
    const timers = scheduled.current;
    return () => {
      timers.forEach(clearTimeout);
      timers.clear();
    };
  }, []);
}

const TONE: Record<ShoutTone, string> = {
  bet: 'from-yellow-200 via-amber-300 to-orange-500 text-red-800',
  good: 'from-emerald-100 via-emerald-300 to-emerald-500 text-emerald-950',
  bad: 'from-rose-100 via-rose-300 to-rose-500 text-rose-950',
  info: 'from-white via-violet-100 to-violet-300 text-violet-950',
};
const BANNER_TONE: Record<ShoutTone, string> = {
  bet: 'bg-amber-300 text-amber-950',
  good: 'bg-emerald-400 text-emerald-950',
  bad: 'bg-rose-500 text-white',
  info: 'bg-slate-200 text-slate-900',
};

export function ShoutOverlay() {
  const shout = useGaudStore((s) => s.effects.findLast((e) => e.kind === 'shout'));
  if (!shout) return null;
  return (
    <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center overflow-hidden" aria-live="assertive">
      {shout.tone === 'bet' && <span aria-hidden className={cn('absolute size-[140%] rounded-full', trucoStyles.rays)} />}
      <span
        key={shout.id}
        className={cn(
          'font-display relative max-w-[92%] rounded-3xl border-4 border-white bg-linear-to-b px-5 py-2 text-center text-[clamp(1.8rem,10vw,4.8rem)] leading-none font-black tracking-tight uppercase shadow-[0_10px_0_rgb(0_0_0/0.35),0_0_60px_rgb(253_224_71/0.6)]',
          TONE[shout.tone],
          trucoStyles.shout,
        )}
      >
        {shout.text}
      </span>
    </div>
  );
}

export function RoundBanner() {
  const banner = useGaudStore((s) => s.effects.findLast((e) => e.kind === 'banner'));
  if (!banner) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 top-[38%] z-20 flex justify-center px-4" role="status" aria-live="polite">
      <span key={banner.id} className={cn('rounded-full px-5 py-2 text-center text-base font-black shadow-[0_6px_0_rgb(0_0_0/0.3)] sm:text-lg', BANNER_TONE[banner.tone], trucoStyles.bubble)}>
        {banner.text}
      </span>
    </div>
  );
}

/**
 * Placa que explica como saiu o último envido/flor: quem marcou, os pontos de cada
 * lado e por quê (comparação, fuga ou flor sem flor do outro lado).
 */
export function SideResultCard({ myTeam, nameOf }: { myTeam: GaudTeam; nameOf(seat: GaudSeat): string }) {
  const effect = useGaudStore((s) => s.effects.findLast((e) => e.kind === 'side'));
  if (!effect || effect.kind !== 'side') return null;
  const { title, detail, ours } = describeSide(effect.result, myTeam, nameOf);
  const flor = effect.result.kind === 'flor';
  return (
    <div className="pointer-events-none absolute inset-x-0 top-[22%] z-20 flex justify-center px-3" role="status" aria-live="polite">
      <div
        key={effect.id}
        className={cn(
          'flex max-w-sm flex-col items-center gap-0.5 rounded-2xl px-4 py-2 text-center shadow-[0_6px_0_rgb(0_0_0/0.3)] ring-2',
          flor ? 'bg-fuchsia-950/90 ring-fuchsia-300' : 'bg-sky-950/90 ring-sky-300',
          trucoStyles.bubble,
        )}
        style={{ animationDuration: '5.5s' }}
      >
        <span className={cn('font-display text-lg font-black sm:text-xl', ours ? 'text-emerald-200' : 'text-rose-200')}>{title}</span>
        <span className="text-xs font-semibold text-white/90 sm:text-sm">{detail}</span>
      </div>
    </div>
  );
}

/** Balão com a última frase que `seat` disse no chat. `below` abre para baixo (lugar do topo). */
export function SayBubble({ seat, below = false, align = 'center' }: { seat: GaudSeat; below?: boolean; align?: 'center' | 'start' | 'end' }) {
  const say = useGaudStore((s) => s.effects.findLast((e) => e.kind === 'say' && e.seat === seat));
  if (!say || say.kind !== 'say') return null;
  return (
    <span
      key={say.id}
      role="status"
      className={cn(
        'pointer-events-none absolute z-30 w-max max-w-[11rem] rounded-2xl px-3 py-1.5 text-center text-xs font-bold shadow-lg ring-2 sm:max-w-[14rem] sm:text-sm',
        below ? 'top-full mt-1' : 'bottom-full mb-1',
        // Nas bordas o balão abre para dentro da mesa, para não sair da tela.
        align === 'center' ? 'left-1/2 -translate-x-1/2' : align === 'start' ? 'left-0' : 'right-0',
        say.to === 'team' ? 'bg-emerald-50 text-emerald-950 ring-emerald-400' : 'bg-white text-slate-900 ring-white',
        trucoStyles.bubble,
      )}
      style={{ animationDuration: '4.5s' }}
    >
      {say.to === 'team' && <span className="mr-1 text-[10px] font-black text-emerald-600 uppercase">dupla</span>}
      {say.text}
    </span>
  );
}

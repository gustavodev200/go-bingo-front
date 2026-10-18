'use client';

import { ChevronLeft, ChevronRight, LogOut, Smile } from 'lucide-react';
import { useState, useSyncExternalStore, type ReactNode } from 'react';
import { dominoTeamOf, type DominoHandTile, type DominoPrivateHand, type DominoRoomState, type DominoSide } from '@/contracts';
import { Avatar } from '@/components/stage/avatar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { SoundToggle } from '@/features/game/sound-toggle';
import { NarrationToggle } from '@/features/game/sound/narration-toggle';
import { useBusy } from '@/features/truco/action-bar';
import { EmoteBubble, TurnClock } from '@/features/uno/opponent-seat';
import { EmoteBar } from '@/features/uno/pickers';
import { cn } from '@/lib/utils';
import type { AudioControls } from './audio';
import { Board } from './board';
import type { DominoActions } from './connection';
import { DominoTileView } from './domino-tile';
import { MyHand } from './my-hand';
import { OpponentSeat, TeamBadge, type Emote } from './opponent-seat';
import { ResultPanel, winnerTitle } from './result-panel';
import { autoSide, availableActions, opponentsOf, rulesLabel, type SeatSpot } from './rules-view';
import { Banner, ShoutOverlay } from './shout-overlay';
import { useDominoStore, type DominoEffect } from './store';
import styles from './domino.module.css';

function LeaveButton({ playing, onLeave }: { playing: boolean; onLeave(): Promise<unknown> }) {
  if (!playing)
    return (
      <Button variant="secondary" size="icon" className="size-9" aria-label="Sair da mesa" onClick={() => void onLeave()}>
        <LogOut aria-hidden />
      </Button>
    );
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="secondary" size="icon" className="size-9" aria-label="Sair da mesa">
          <LogOut aria-hidden />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sair da partida?</DialogTitle>
          <DialogDescription>Você sai do jogo e suas peças voltam para o monte. Em duplas, a sua dupla perde.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">Continuar jogando</Button>
          </DialogClose>
          <Button variant="destructive" onClick={() => void onLeave()}>
            Sair da partida
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Between rounds: who won, how, and what everyone still held. */
function RoundSummary({ state, mySeat }: { state: DominoRoomState; mySeat: number }) {
  const last = state.round!.lastRound!;
  const how = last.winners.length === 0 ? 'Jogo trancado, empate na menor mão.' : last.blocked ? `Jogo trancado: menor mão, +${last.points} pontos.` : `Bateu! +${last.points} pontos.`;
  return (
    <div className="absolute inset-x-0 top-[18%] z-20 flex justify-center px-4" role="status">
      <div className="glass flex max-w-xs flex-col items-center gap-2 px-5 py-3 text-center">
        <strong className="font-display text-lg">{winnerTitle(state, last.winners, mySeat).replace('venceu', 'venceu a rodada')}</strong>
        <span className="text-sm text-white/85">{how}</span>
        <ul className="flex flex-wrap justify-center gap-1.5 text-xs">
          {state.seats.map((s, seat) =>
            s ? (
              <li key={seat} className="rounded-full bg-black/30 px-2 py-0.5">
                {s.nickname}: <strong className="tabular-nums">{last.pips[seat]}</strong>
              </li>
            ) : null,
          )}
        </ul>
        <span className="text-xs text-white/70">Próxima rodada já vai começar…</span>
      </div>
    </div>
  );
}

/** The boneyard: a small stack and how many tiles are left to buy. */
function Boneyard({ count }: { count: number }) {
  return (
    <div className="flex items-center gap-1.5 rounded-full bg-black/35 px-2.5 py-1 text-xs font-semibold text-white" aria-label={`Monte com ${count} ${count === 1 ? 'peça' : 'peças'}`}>
      <span aria-hidden className="flex -space-x-2">
        {Array.from({ length: Math.min(3, Math.max(count, 1)) }, (_, i) => (
          <DominoTileView key={i} tile={null} className={cn('w-2.5', count === 0 && 'opacity-30')} />
        ))}
      </span>
      Monte: {count}
    </div>
  );
}

type TableLayout = 'around' | 'stacked' | 'short';

const STACKED = '(max-width: 639px)';
const SHORT = '(max-height: 520px) and (orientation: landscape)';

function subscribe(onChange: () => void) {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {};
  const queries = [window.matchMedia(STACKED), window.matchMedia(SHORT)];
  queries.forEach((q) => q.addEventListener('change', onChange));
  return () => queries.forEach((q) => q.removeEventListener('change', onChange));
}

function currentLayout(): TableLayout {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'around';
  if (window.matchMedia(SHORT).matches) return 'short';
  return window.matchMedia(STACKED).matches ? 'stacked' : 'around';
}

/**
 * Where the opponents go: around the felt on wide screens, in one row above it
 * on narrow phones (the felt keeps the full width), and in the side columns on
 * short landscape phones (the felt keeps the full height).
 */
function useTableLayout(): TableLayout {
  return useSyncExternalStore(subscribe, currentLayout, () => 'around');
}

/**
 * The 2D table: the line of tiles on the felt in the middle, opponents around
 * it (the next player on my right: play goes anti-clockwise), my tiles and
 * buttons at the bottom.
 */
export function TableView({ state, mySeat, hand, actions, audio }: { state: DominoRoomState; mySeat: number; hand: DominoPrivateHand | null; actions: DominoActions; audio: AudioControls }) {
  const effects = useDominoStore((s) => s.effects);
  const layout = useTableLayout();
  const { busy, run } = useBusy();
  const [selected, setSelected] = useState<string | null>(null);
  const [emotesOpen, setEmotesOpen] = useState(false);
  const round = state.round;
  const me = state.seats[mySeat];
  const available = availableActions(state, hand, mySeat);
  const teams = state.rules.teams;
  const showScore = state.rules.target > 0;
  const roundRunning = state.phase === 'PLAYING' && round?.phase === 'PLAYING';
  const emoteOf = (seat: number): Emote => (effects.findLast((e) => e.kind === 'emote' && e.seat === seat) as Extract<DominoEffect, { kind: 'emote' }> | undefined) ?? null;
  const turnPlayer = round ? state.seats[round.turn] : null;
  // A selection only lasts while that tile can still be played.
  const choosing = selected !== null && available.playable.has(selected) ? selected : null;

  function tap(tile: DominoHandTile) {
    if (choosing === tile.id) return setSelected(null);
    const side = autoSide(available.playable.get(tile.id) ?? [], round?.ends ?? null);
    if (side === null) return setSelected(tile.id);
    setSelected(null);
    void actions.play(tile.id, side);
  }

  function pick(side: DominoSide) {
    if (!choosing) return;
    setSelected(null);
    void actions.play(choosing, side);
  }

  const opponents = opponentsOf(state, mySeat);
  const seatAt = (spot: SeatSpot) => {
    const found = opponents.find((o) => o.spot === spot);
    if (!found) return null;
    const player = state.seats[found.seat]!;
    return (
      <OpponentSeat
        player={player}
        tiles={round?.handCounts[found.seat] ?? 0}
        score={state.scores[found.seat] ?? 0}
        showScore={showScore}
        isTurn={roundRunning && round!.turn === found.seat}
        isHost={state.hostId === player.userId}
        team={teams ? dominoTeamOf(found.seat) : null}
        partner={teams && dominoTeamOf(found.seat) === dominoTeamOf(mySeat)}
        deadline={round?.turnDeadline ?? null}
        emote={emoteOf(found.seat)}
      />
    );
  };

  let status: ReactNode = null;
  if (choosing) status = 'Toque em uma ponta brilhando';
  else if (available.mustDraw) status = 'Nenhuma peça serve: compre do monte';
  else if (available.myTurn) status = <span className={cn('font-display rounded-full bg-amber-300 px-4 py-1 text-base font-black text-emerald-900 italic shadow', styles.pulse)}>Sua vez!</span>;
  else if (roundRunning && turnPlayer) status = `Vez de ${turnPlayer.nickname}`;

  const felt = (
    <div className={cn('relative min-h-0 min-w-0 flex-1 overflow-hidden rounded-[clamp(18px,5vmin,48px)]', styles.table)}>
      {round && <Board line={round.line} origin={round.origin} ends={round.ends} choosing={!!choosing} onPick={pick} />}
      {round?.phase === 'ROUND_OVER' && state.phase === 'PLAYING' && round.lastRound && <RoundSummary state={state} mySeat={mySeat} />}
      <Banner />
      <ShoutOverlay />
    </div>
  );

  return (
    <div className={cn('relative flex h-dvh flex-col overflow-hidden', styles.backdrop)}>
      <header className="flex items-center gap-2 px-2 pt-[calc(0.5rem+env(safe-area-inset-top))] pb-1 sm:px-4">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="font-display rounded-xl border-2 border-white bg-stone-900 px-2 text-lg font-black text-amber-200 shadow">Dominó</span>
          <span className="truncate rounded-full bg-black/35 px-3 py-1 text-xs font-semibold text-white">
            {round ? `Rodada ${round.roundNumber} · ` : ''}
            {rulesLabel(state.rules)}
          </span>
        </div>
        {round && <Boneyard count={round.boneyard} />}
        <div className="flex gap-1">
          <SoundToggle muted={!audio.sfx} onChange={(muted) => audio.setSfx(!muted)} />
          <NarrationToggle enabled={audio.voice} onChange={audio.setVoice} />
        </div>
        <LeaveButton playing={state.phase === 'PLAYING'} onLeave={actions.leave} />
      </header>

      {layout === 'stacked' && (
        <div className="flex min-h-0 flex-1 flex-col gap-1 px-1">
          <div className="flex items-start justify-around gap-1">
            {seatAt('left')}
            {seatAt('top')}
            {seatAt('right')}
          </div>
          {felt}
        </div>
      )}
      {layout === 'short' && (
        <div className="flex min-h-0 flex-1 gap-2 px-2">
          <div className="flex flex-col justify-around gap-1">
            {seatAt('top')}
            {seatAt('left')}
          </div>
          {felt}
          <div className="flex flex-col justify-around">{seatAt('right')}</div>
        </div>
      )}
      {layout === 'around' && (
        <div className="flex min-h-0 flex-1 flex-col gap-1 px-2 sm:px-4">
          <div className="flex justify-center">{seatAt('top')}</div>
          <div className="flex min-h-0 flex-1 gap-3">
            <div className="flex items-center">{seatAt('left')}</div>
            {felt}
            <div className="flex items-center">{seatAt('right')}</div>
          </div>
        </div>
      )}

      <footer className="relative flex items-end gap-2 px-2 pt-1 pb-[calc(0.5rem+env(safe-area-inset-bottom))] sm:px-4">
        {me && (
          <div className="relative flex shrink-0 flex-col items-center gap-1">
            <EmoteBubble seat={mySeat} name={me.nickname} emote={emoteOf(mySeat)} />
            {available.myTurn && (
              <span className="absolute -top-3 -right-3 z-10">
                <TurnClock deadline={round?.turnDeadline ?? null} />
              </span>
            )}
            <div className={cn('rounded-full p-0.5 ring-3', available.myTurn ? 'ring-amber-300' : 'ring-white/50', available.myTurn && styles.turn)}>
              <div className="flex size-10 items-end justify-center overflow-hidden rounded-full bg-black/40 sm:size-12">
                <Avatar id={me.userId} character={me.character} className="w-[85%] translate-y-[6%]" />
              </div>
            </div>
            <span className="flex max-w-20 items-center gap-1 truncate text-xs font-semibold text-white">
              {teams && <TeamBadge team={dominoTeamOf(mySeat)} mine />}
              <span className="truncate">{me.nickname}</span>
              {showScore && <span className="text-amber-200 tabular-nums">{state.scores[mySeat]}</span>}
            </span>
          </div>
        )}
        <div className="flex min-w-0 flex-1 flex-col items-center">
          <div role="status" className="flex min-h-9 flex-wrap items-center justify-center gap-2 text-center text-sm font-bold text-white drop-shadow">
            {status}
            {choosing && round?.ends && (
              <span className="flex gap-2">
                <Button size="sm" variant="secondary" className="h-9 gap-1 rounded-xl" onClick={() => pick('left')}>
                  <ChevronLeft aria-hidden className="size-4" /> Ponta {round.ends[0]}
                </Button>
                <Button size="sm" variant="secondary" className="h-9 gap-1 rounded-xl" onClick={() => pick('right')}>
                  Ponta {round.ends[1]} <ChevronRight aria-hidden className="size-4" />
                </Button>
              </span>
            )}
            {available.mustDraw && (
              <Button
                disabled={busy}
                onClick={run(actions.draw)}
                className="font-display h-10 rounded-2xl bg-linear-to-b from-amber-200 to-amber-500 px-5 text-base font-black text-amber-950 shadow-[0_4px_0_rgb(0_0_0/0.35)] active:translate-y-0.5 active:shadow-none"
              >
                Comprar do monte
              </Button>
            )}
          </div>
          {hand && state.phase === 'PLAYING' && <MyHand tiles={hand.tiles} playable={available.playable} myTurn={available.myTurn} selected={choosing} onTap={tap} />}
        </div>
        <div className="relative flex shrink-0 justify-end">
          {emotesOpen ? (
            <div className="absolute right-0 bottom-0 z-20">
              <EmoteBar
                onSend={(emote) => {
                  setEmotesOpen(false);
                  void actions.emote(emote);
                }}
              />
            </div>
          ) : (
            <Button variant="secondary" size="icon" className="size-10 rounded-full" aria-label="Reagir" onClick={() => setEmotesOpen(true)}>
              <Smile aria-hidden />
            </Button>
          )}
        </div>
      </footer>

      {state.phase === 'FINISHED' && state.result && <ResultPanel state={state} mySeat={mySeat} onRematch={actions.rematch} onLeave={actions.leave} />}
    </div>
  );
}

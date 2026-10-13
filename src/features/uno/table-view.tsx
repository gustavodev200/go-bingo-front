'use client';

import { LogOut, Smile } from 'lucide-react';
import { useState } from 'react';
import type { UnoHandCard, UnoPrivateHand, UnoRoomState } from '@/contracts';
import { Avatar } from '@/components/stage/avatar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { SoundToggle } from '@/features/game/sound-toggle';
import { NarrationToggle } from '@/features/game/sound/narration-toggle';
import { cn } from '@/lib/utils';
import type { AudioControls } from './audio';
import type { UnoActions } from './connection';
import { MyHand } from './my-hand';
import { EmoteBubble, OpponentSeat, TurnClock } from './opponent-seat';
import { ColorPicker, EmoteBar, TargetPicker } from './pickers';
import { ResultPanel } from './result-panel';
import { availableActions, opponentsOf, placementOf, TARGET_LABEL } from './rules-view';
import { Banner, ShoutOverlay } from './shout-overlay';
import { useUnoStore, type UnoEffect } from './store';
import { TableCenter } from './table-center';
import { TurnControls, UnoButtons } from './uno-controls';
import styles from './uno.module.css';

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
          <DialogDescription>Você sai do jogo e suas cartas voltam para o monte. A partida continua sem você.</DialogDescription>
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

type Picking = { kind: 'color' | 'target'; card: UnoHandCard } | null;

/** The 2D table: opponents in an arc, the piles in the middle, my hand and buttons at the bottom. */
export function TableView({ state, mySeat, hand, actions, audio }: { state: UnoRoomState; mySeat: number; hand: UnoPrivateHand | null; actions: UnoActions; audio: AudioControls }) {
  const effects = useUnoStore((s) => s.effects);
  const [picking, setPicking] = useState<Picking>(null);
  const [emotesOpen, setEmotesOpen] = useState(false);
  const round = state.round;
  const me = state.seats[mySeat];
  const available = availableActions(state, hand, mySeat);
  const opponents = opponentsOf(state, mySeat);
  const showScore = state.rules.target > 0;
  const emoteOf = (seat: number) => (effects.findLast((e) => e.kind === 'emote' && e.seat === seat) as Extract<UnoEffect, { kind: 'emote' }> | undefined) ?? null;
  const turnPlayer = round ? state.seats[round.turn] : null;
  const exposedName = round?.unoExposed != null ? (state.seats[round.unoExposed]?.nickname ?? null) : null;
  const roundRunning = state.phase === 'PLAYING' && round?.phase === 'PLAYING';
  const handCount = hand?.cards.length ?? 0;

  function play(card: UnoHandCard) {
    if (card.card.color === 'wild') return setPicking({ kind: 'color', card });
    if (state.rules.sevenZero && card.card.value === '7' && handCount > 1) return setPicking({ kind: 'target', card });
    void actions.playCard(card.id, {});
  }

  function finish(opts: Parameters<UnoActions['playCard']>[1]) {
    if (!picking) return;
    const { card } = picking;
    setPicking(null);
    void actions.playCard(card.id, opts);
  }

  return (
    <div className={cn('relative flex h-dvh flex-col overflow-hidden', styles.backdrop)}>
      <header className="flex items-center gap-2 px-2 pt-[calc(0.5rem+env(safe-area-inset-top))] pb-1 sm:px-4">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="font-display rounded-xl border-2 border-white bg-red-600 px-2 text-lg font-black text-amber-300 italic shadow" style={{ textShadow: '-1px 1px 0 #000' }}>
            UNO
          </span>
          <span className="truncate rounded-full bg-black/35 px-3 py-1 text-xs font-semibold text-white">
            {round ? `Rodada ${round.roundNumber} · ` : ''}
            {TARGET_LABEL[state.rules.target]}
            {state.rules.stacking ? ' · Empilhar' : ''}
            {state.rules.sevenZero ? ' · 7-0' : ''}
          </span>
        </div>
        <div className="flex gap-1">
          <SoundToggle muted={!audio.sfx} onChange={(muted) => audio.setSfx(!muted)} />
          <NarrationToggle enabled={audio.voice} onChange={audio.setVoice} />
        </div>
        <LeaveButton playing={state.phase === 'PLAYING'} onLeave={actions.leave} />
      </header>

      <div className="relative min-h-0 flex-1 px-2 sm:px-6">
        <div className={cn('relative mx-auto h-full w-full max-w-4xl rounded-[50%] [container-type:size]', styles.table)}>
          {opponents.map((seat, i) => {
            const player = state.seats[seat]!;
            const spot = placementOf(i, opponents.length);
            return (
              <div key={seat} className="absolute z-10 -translate-x-1/2" style={{ left: `${spot.left}%`, top: `${spot.top}%` }}>
                <OpponentSeat
                  player={player}
                  cards={round?.handCounts[seat] ?? 0}
                  score={state.scores[seat] ?? 0}
                  showScore={showScore}
                  isTurn={roundRunning && round!.turn === seat}
                  isHost={state.hostId === player.userId}
                  saidUno={!!round?.saidUno[seat]}
                  exposed={round?.unoExposed === seat}
                  deadline={round?.turnDeadline ?? null}
                  emote={emoteOf(seat)}
                />
              </div>
            );
          })}
          {round && <TableCenter round={round} canDraw={available.canDraw} onDraw={() => void actions.draw()} />}
          {round?.phase === 'ROUND_OVER' && state.phase === 'PLAYING' && round.lastRound && (
            <div className="absolute inset-x-0 top-[30%] z-20 flex justify-center" role="status">
              <span className="glass px-5 py-3 text-center text-sm font-bold">
                {state.seats[round.lastRound.winner]?.nickname ?? 'Alguém'} bateu e somou {round.lastRound.points} pontos. Próxima rodada já vai começar…
              </span>
            </div>
          )}
          <Banner />
          <ShoutOverlay />
        </div>
      </div>

      <footer className="relative flex flex-col px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] sm:px-4">
        <TurnControls available={available} actions={actions} turnName={turnPlayer?.nickname ?? null} />
        {hand && state.phase === 'PLAYING' && <MyHand cards={hand.cards} playable={available.playable} drawnId={hand.drawnCardId} myTurn={available.myTurn} onPlay={play} />}
        <div className="flex items-end justify-between gap-2">
          {me && (
            <div className="flex items-end gap-2">
              <div className="relative flex flex-col items-center gap-1">
                <EmoteBubble seat={mySeat} name={me.nickname} emote={emoteOf(mySeat)} />
                <div className={cn('rounded-full p-0.5 ring-3', available.myTurn ? 'ring-amber-300' : 'ring-white/50', available.myTurn && styles.turn)}>
                  <div className="flex size-12 items-end justify-center overflow-hidden rounded-full bg-black/40 sm:size-14">
                    <Avatar id={me.userId} character={me.character} className="w-[85%] translate-y-[6%]" />
                  </div>
                </div>
                <span className="max-w-20 truncate text-xs font-semibold text-white">
                  {me.nickname}
                  {showScore && <span className="text-amber-200 tabular-nums"> · {state.scores[mySeat]}</span>}
                </span>
              </div>
              {available.myTurn && <TurnClock deadline={round?.turnDeadline ?? null} />}
            </div>
          )}
          <div className="relative flex flex-1 justify-center">
            {emotesOpen ? (
              <EmoteBar
                onSend={(emote) => {
                  setEmotesOpen(false);
                  void actions.emote(emote);
                }}
              />
            ) : (
              <Button variant="secondary" size="icon" className="size-10 rounded-full" aria-label="Reagir" onClick={() => setEmotesOpen(true)}>
                <Smile aria-hidden />
              </Button>
            )}
          </div>
          <UnoButtons available={available} actions={actions} exposedName={exposedName} />
        </div>
      </footer>

      <ColorPicker open={picking?.kind === 'color'} onPick={(color) => finish({ color })} onClose={() => setPicking(null)} />
      <TargetPicker open={picking?.kind === 'target'} state={state} seats={opponents} onPick={(target) => finish({ target })} onClose={() => setPicking(null)} />
      {state.phase === 'FINISHED' && state.result && <ResultPanel state={state} mySeat={mySeat} onRematch={actions.rematch} onLeave={actions.leave} />}
    </div>
  );
}

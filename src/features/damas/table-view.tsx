'use client';

import { Crown, Flag, Handshake, LogOut, Smile, WifiOff } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { damasColorOf, type DamasColor, type DamasMove, type DamasRoomState, type DamasSeatPlayer } from '@/contracts';
import { Avatar } from '@/components/stage/avatar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { SoundToggle } from '@/features/game/sound-toggle';
import { NarrationToggle } from '@/features/game/sound/narration-toggle';
import { useBusy } from '@/features/truco/action-bar';
import { useSecondsLeft } from '@/features/truco/seat-badge';
import { EmoteBubble } from '@/features/uno/opponent-seat';
import { EmoteBar } from '@/features/uno/pickers';
import { cn } from '@/lib/utils';
import type { AudioControls } from './audio';
import { Board, PieceView } from './board';
import { capturedBy } from './board-logic';
import type { DamasActions } from './connection';
import { ResultPanel } from './result-panel';
import { drawCountdown, turnLabel } from './rules-view';
import { Banner, ShoutOverlay } from './shout-overlay';
import { useDamasStore, type DamasEffect } from './store';
import styles from './damas.module.css';

type Emote = Extract<DamasEffect, { kind: 'emote' }> | null;

function ConfirmButton({ label, icon, title, description, confirm, disabled, onConfirm }: { label: string; icon: ReactNode; title: string; description: string; confirm: string; disabled?: boolean; onConfirm(): void }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="secondary" className="h-10 gap-1.5 rounded-xl px-3" disabled={disabled}>
          {icon}
          <span>{label}</span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">Continuar jogando</Button>
          </DialogClose>
          <DialogClose asChild>
            <Button variant="destructive" onClick={onConfirm}>
              {confirm}
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

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
          <DialogDescription>Sair no meio conta como derrota e paga multa na Arena.</DialogDescription>
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

function Clock({ deadline }: { deadline: number | null }) {
  const seconds = useSecondsLeft(deadline);
  if (seconds === null) return null;
  const text = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  return (
    <span role="timer" aria-label={`${seconds} segundos`} className={cn('rounded-lg px-2 py-0.5 font-mono text-sm font-black tabular-nums shadow', seconds <= 10 ? 'bg-rose-500 text-white' : 'bg-amber-300 text-amber-950')}>
      {text}
    </span>
  );
}

/** One side of the board: who plays, their colour, what they captured, their clock. */
function PlayerBar({
  player,
  color,
  captured,
  active,
  deadline,
  timeouts,
  isHost,
  me,
  emote,
}: {
  player: DamasSeatPlayer | null;
  color: DamasColor;
  captured: number;
  active: boolean;
  deadline: number | null;
  timeouts: number;
  isHost: boolean;
  me: boolean;
  emote: Emote;
}) {
  const reconnect = useSecondsLeft(player?.reconnectDeadline ?? null);
  const name = player?.nickname ?? 'Saiu da mesa';
  return (
    <div className={cn('flex min-h-14 items-center gap-2 rounded-2xl bg-black/35 px-2.5 py-1.5 ring-2 backdrop-blur transition-colors', active ? 'ring-amber-300' : 'ring-white/10')} data-active={active || undefined}>
      <div className="relative shrink-0">
        {player && <EmoteBubble seat={player.seat} name={player.nickname} emote={emote} />}
        <div className={cn('flex size-10 items-end justify-center overflow-hidden rounded-full bg-black/40 ring-2', active ? 'ring-amber-300' : 'ring-white/30', active && styles.turn, player && !player.connected && 'opacity-50 grayscale')}>
          {player && <Avatar id={player.userId} character={player.character} className="w-[85%] translate-y-[6%]" />}
        </div>
        {isHost && <Crown aria-label="Anfitrião" className="absolute -top-1.5 -left-1 size-4 fill-amber-300 text-amber-500" />}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="flex items-center gap-1.5 truncate text-sm font-bold text-white">
          <span className="relative size-4 shrink-0 [container-type:inline-size]" title={color === 'white' ? 'Brancas' : 'Pretas'}>
            <PieceView cell={color === 'white' ? 'w' : 'b'} className="inset-0!" />
          </span>
          <span className="truncate">
            {name}
            {me && <span className="text-amber-200"> (você)</span>}
          </span>
        </span>
        <span className="flex items-center gap-2 text-xs text-white/75">
          <span aria-label={`${captured} ${captured === 1 ? 'peça capturada' : 'peças capturadas'}`}>
            Capturou <strong className="text-white tabular-nums">{captured}</strong>
          </span>
          {timeouts > 0 && (
            <span className="rounded-full bg-rose-500/80 px-1.5 font-bold text-white" aria-label={`${timeouts} tempos estourados seguidos`}>
              ⏱ {timeouts}/3
            </span>
          )}
          {player && !player.connected && (
            <span className="flex items-center gap-1 font-bold text-amber-300">
              <WifiOff aria-hidden className="size-3" /> {reconnect}s
            </span>
          )}
        </span>
      </div>
      {active && <Clock deadline={deadline} />}
    </div>
  );
}

/**
 * The match: the board in the middle, the opponent above and me below on
 * phones; on wide or landscape screens the players and buttons go to the side.
 */
export function TableView({ state, mySeat, actions, audio }: { state: DamasRoomState; mySeat: number; actions: DamasActions; audio: AudioControls }) {
  const effects = useDamasStore((s) => s.effects);
  const { busy, run } = useBusy();
  const [emotesOpen, setEmotesOpen] = useState(false);
  const game = state.game;
  const other = 1 - mySeat;
  const mine = damasColorOf(state, mySeat);
  const theirs = damasColorOf(state, other);
  const playing = state.phase === 'PLAYING' && !!game;
  const myTurn = playing && game.turn === mine;
  const captured = game ? capturedBy(game.board) : { white: 0, black: 0 };
  const emoteOf = (seat: number): Emote => (effects.findLast((e) => e.kind === 'emote' && e.seat === seat) as Emote | undefined) ?? null;
  const offerFromOther = playing && game.drawOffer === other;
  const offerFromMe = playing && game.drawOffer === mySeat;
  const capturing = myTurn && (game.moves[0]?.captures.length ?? 0) > 0;
  const countdown = game ? drawCountdown(game.quietMoves) : null;
  const opponent = state.seats[other];

  let status: ReactNode = null;
  if (!playing) status = null;
  else if (capturing) status = <span className={cn('font-display rounded-full bg-rose-500 px-4 py-1 text-base font-black text-white italic shadow', styles.pulse)}>Captura obrigatória!</span>;
  else if (myTurn) status = <span className={cn('font-display rounded-full bg-amber-300 px-4 py-1 text-base font-black text-amber-950 italic shadow', styles.pulse)}>Sua vez!</span>;
  else status = `Vez de ${opponent?.nickname ?? 'adversário'}`;

  const moves: DamasMove[] = myTurn ? game.moves : [];

  return (
    <div className={cn('relative flex h-dvh flex-col overflow-hidden', styles.backdrop)}>
      <header className="flex items-center gap-2 px-2 pt-[calc(0.5rem+env(safe-area-inset-top))] pb-1 sm:px-4">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="font-display rounded-xl border-2 border-white bg-stone-900 px-2 text-lg font-black text-amber-200 shadow">Damas</span>
          <span className="truncate rounded-full bg-black/35 px-3 py-1 text-xs font-semibold text-white">
            {turnLabel(state.rules.turnSeconds)} por lance{game ? ` · lance ${Math.floor(game.plies / 2) + 1}` : ''}
          </span>
        </div>
        <div className="flex gap-1">
          <SoundToggle muted={!audio.sfx} onChange={(muted) => audio.setSfx(!muted)} />
          <NarrationToggle enabled={audio.voice} onChange={audio.setVoice} />
        </div>
        <LeaveButton playing={state.phase === 'PLAYING'} onLeave={actions.leave} />
      </header>

      <div className={styles.layout}>
        <div className={styles.areaOpp}>
          <PlayerBar
            player={opponent}
            color={theirs}
            captured={captured[theirs]}
            active={playing && game.turn === theirs}
            deadline={game?.turnDeadline ?? null}
            timeouts={game?.timeouts[other] ?? 0}
            isHost={!!opponent && state.hostId === opponent.userId}
            me={false}
            emote={emoteOf(other)}
          />
        </div>

        <div className={styles.areaBoard}>
          <div className={styles.boardBox}>
            {game && <Board board={game.board} orientation={mine} moves={moves} lastMove={game.lastMove} moveId={game.plies} onMove={(m) => void actions.move(m.from, m.path)} />}
            <Banner />
            <ShoutOverlay />
          </div>
        </div>

        <div className={styles.areaMe}>
          <PlayerBar
            player={state.seats[mySeat]}
            color={mine}
            captured={captured[mine]}
            active={myTurn}
            deadline={game?.turnDeadline ?? null}
            timeouts={game?.timeouts[mySeat] ?? 0}
            isHost={state.hostId === state.seats[mySeat]?.userId}
            me
            emote={emoteOf(mySeat)}
          />
        </div>

        <div className={cn(styles.areaBar, 'flex flex-col items-center gap-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]')}>
          <div role="status" className="flex min-h-9 flex-wrap items-center justify-center gap-2 text-center text-sm font-bold text-white drop-shadow">
            {status}
            {countdown !== null && <span className="rounded-full bg-black/40 px-3 py-1 text-xs font-semibold">Empate em {countdown} lances só de damas</span>}
          </div>
          {offerFromOther && (
            <div className="flex w-full max-w-sm items-center gap-2 rounded-2xl bg-amber-300 p-2 pl-3 text-amber-950 shadow-lg" role="alert">
              <Handshake aria-hidden className="size-5 shrink-0" />
              <span className="flex-1 text-sm font-bold">{opponent?.nickname ?? 'O adversário'} propõe empate</span>
              <Button size="sm" className="h-9 rounded-xl" disabled={busy} onClick={run(() => actions.answerDraw(true))}>
                Aceitar
              </Button>
              <Button size="sm" variant="secondary" className="h-9 rounded-xl" disabled={busy} onClick={run(() => actions.answerDraw(false))}>
                Recusar
              </Button>
            </div>
          )}
          {playing && (
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button variant="secondary" className="h-10 gap-1.5 rounded-xl px-3" disabled={busy || game.drawOffer !== null} onClick={run(actions.offerDraw)}>
                <Handshake aria-hidden className="size-4" />
                <span>{offerFromMe ? 'Empate proposto' : 'Propor empate'}</span>
              </Button>
              <ConfirmButton
                label="Desistir"
                icon={<Flag aria-hidden className="size-4" />}
                title="Desistir da partida?"
                description="Desistir conta como derrota. O adversário leva a vitória."
                confirm="Desistir"
                disabled={busy}
                onConfirm={() => void actions.resign()}
              />
              <div className="relative">
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
            </div>
          )}
        </div>
      </div>

      {state.phase === 'FINISHED' && state.result && <ResultPanel state={state} mySeat={mySeat} onRematch={actions.rematch} onLeave={actions.leave} />}
    </div>
  );
}

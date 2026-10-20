'use client';

import { Home, LogOut, RotateCcw } from 'lucide-react';
import { gaudTeamOf, type GaudMatchResult, type GaudPrivateHand, type GaudRoomState, type GaudSeat, type GaudTeam } from '@/contracts';
import { Avatar } from '@/components/stage/avatar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { MatchRewardPanel } from '@/features/arena/reward-panel';
import { SoundToggle } from '@/features/game/sound-toggle';
import { NarrationToggle } from '@/features/game/sound/narration-toggle';
import { useBusy } from '@/features/truco/action-bar';
import { TEAM_TONE } from '@/features/truco/seat-badge';
import trucoStyles from '@/features/truco/truco.module.css';
import { cn } from '@/lib/utils';
import { ActionBar } from './action-bar';
import type { GaudActionsApi } from './connection';
import styles from './gauderio.module.css';
import { MyHand } from './my-hand';
import { PendingStrip, RoundBanner, Scoreboard, SeatBadge, ShoutOverlay, TableCenter } from './table-parts';
import { otherSeats, positionOf, type TablePosition } from './view';

const PLACE: Record<Exclude<TablePosition, 'bottom'>, string> = {
  top: 'top-[3%] left-1/2 -translate-x-1/2',
  left: 'left-[2%] top-1/2 -translate-y-1/2',
  right: 'right-[2%] top-1/2 -translate-y-1/2',
};

export interface AudioControls {
  voice: boolean;
  setVoice(v: boolean): void;
  sfx: boolean;
  setSfx(v: boolean): void;
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
          <DialogDescription>Sair agora entrega a partida para os adversários (W.O.).</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">Continuar jogando</Button>
          </DialogClose>
          <Button variant="destructive" onClick={() => void onLeave()}>
            Sair e entregar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const CONFETTI = ['#fde047', '#34d399', '#f472b6', '#60a5fa', '#fb923c'];

export function ResultPanel({
  result,
  myTeam,
  target,
  solo,
  onRematch,
  onLeave,
}: {
  result: GaudMatchResult;
  myTeam: GaudTeam;
  target: number;
  solo: boolean;
  onRematch(): Promise<unknown>;
  onLeave(): Promise<unknown>;
}) {
  const { busy, run } = useBusy();
  const won = result.winnerTeam === myTeam;
  const us = solo ? 'Você' : 'Sua dupla';
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center overflow-hidden bg-black/55 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="gauderio-result-title">
      {won &&
        Array.from({ length: 28 }, (_, i) => (
          <span
            key={i}
            aria-hidden
            className={cn('absolute top-0 h-3 w-2 rounded-sm', trucoStyles.confetti)}
            style={{ left: `${(i * 37) % 100}%`, background: CONFETTI[i % CONFETTI.length], animationDuration: `${2.4 + (i % 5) * 0.5}s`, animationDelay: `${(i % 7) * 0.3}s` }}
          />
        ))}
      <div className="glass relative flex w-full max-w-sm flex-col items-center gap-3 p-6 text-center">
        <span aria-hidden className="text-6xl">
          {won ? '🏆' : '🧉'}
        </span>
        <h2 id="gauderio-result-title" className={cn('font-display text-4xl font-black', won ? 'text-marquee' : 'text-rose-200')}>
          {won ? 'Vitória!' : 'Derrota'}
        </h2>
        <p className="text-sm text-violet-100">
          {result.reason === 'abandoned'
            ? won
              ? 'O adversário abandonou a mesa.'
              : `${us} abandonou a mesa.`
            : won
              ? `${us} fechou ${target} pontos. Bah, que partida!`
              : `Eles chegaram aos ${target} pontos.`}
        </p>
        <p className="font-display text-3xl font-black tabular-nums">
          <span className="text-emerald-300">{result.scores[myTeam]}</span>
          <span className="mx-2 text-violet-300">×</span>
          <span className="text-rose-300">{result.scores[1 - myTeam]}</span>
        </p>
        <MatchRewardPanel />
        <div className="flex w-full flex-col gap-2 pt-2">
          <Button size="lg" className="h-12 gap-2 rounded-xl text-base" disabled={busy} onClick={run(onRematch)}>
            <RotateCcw aria-hidden /> Jogar de novo
          </Button>
          <Button size="lg" variant="ghost" className="h-12 gap-2 rounded-xl text-violet-200" disabled={busy} onClick={run(onLeave)}>
            <Home aria-hidden /> Sair da mesa
          </Button>
        </div>
      </div>
    </div>
  );
}

/** A mesa 2D: os outros lugares, as cartas da rodada, o placar, minha mão e os botões. */
export function TableView({ state, mySeat, hand, actions, audio }: { state: GaudRoomState; mySeat: GaudSeat; hand: GaudPrivateHand | null; actions: GaudActionsApi; audio: AudioControls }) {
  const match = state.match;
  const size = state.settings.size;
  const myTeam = gaudTeamOf(mySeat);
  const me = state.seats[mySeat];
  const playing = state.phase === 'PLAYING';
  const turnPlayer = match ? state.seats[match.turn] : null;
  const myTurn = !!match && playing && match.turn === mySeat && match.phase === 'AWAITING_PLAY';

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden bg-[radial-gradient(ellipse_at_top,#3b2a17,#140d06_75%)]">
      <header className="flex items-center gap-2 px-2 pt-[calc(0.5rem+env(safe-area-inset-top))] pb-1 sm:px-4">
        <Scoreboard scores={state.scores} myTeam={myTeam} match={match} target={state.settings.target} solo={size === 2} />
        <div className="flex flex-col gap-1 sm:flex-row">
          <SoundToggle muted={!audio.sfx} onChange={(muted) => audio.setSfx(!muted)} />
          <NarrationToggle enabled={audio.voice} onChange={audio.setVoice} />
        </div>
        <LeaveButton playing={playing} onLeave={actions.leave} />
      </header>

      <div className="relative min-h-0 flex-1 px-2 py-1 sm:px-6">
        <div className={cn(styles.felt, 'relative mx-auto h-full w-full max-w-4xl rounded-[clamp(20px,min(8vw,10dvh),72px)] [container-type:size]')}>
          {otherSeats(mySeat, size).map((seat) => {
            const player = state.seats[seat];
            const pos = positionOf(seat, mySeat, size) as Exclude<TablePosition, 'bottom'>;
            if (!player)
              return (
                <span key={seat} className={cn('absolute rounded-full bg-black/40 px-3 py-1 text-xs text-white/70', PLACE[pos])}>
                  Lugar vago
                </span>
              );
            return (
              <div key={seat} className={cn('absolute z-10', PLACE[pos])}>
                <SeatBadge
                  player={player}
                  position={pos}
                  ours={gaudTeamOf(seat) === myTeam}
                  isTurn={!!match && match.turn === seat && playing && match.phase !== 'HAND_OVER'}
                  isMano={match?.mano === seat}
                  isHost={state.hostId === player.userId}
                  cardsLeft={match && playing ? (match.cardsLeft[seat] ?? 0) : 0}
                />
              </div>
            );
          })}
          <TableCenter state={state} mySeat={mySeat} />
          {match && playing && <PendingStrip match={match} />}
          <RoundBanner />
          <ShoutOverlay />
        </div>
      </div>

      <footer className="relative flex flex-col gap-1 px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] sm:px-4">
        {playing && match && (
          <ActionBar
            hand={hand}
            pending={match.phase === 'AWAITING_RESPONSE' ? match.pending : null}
            pendingIsOurs={match.pending?.team === myTeam}
            turnName={match.phase === 'HAND_OVER' ? null : (turnPlayer?.nickname ?? null)}
            onCall={actions.call}
            onRespond={actions.respond}
            onFold={actions.fold}
          />
        )}
        <div className="flex items-end justify-between gap-2">
          <div className="w-14 sm:w-24" />
          <div className="min-w-0 flex-1">
            {hand && playing && <MyHand cards={hand.cards} canPlay={hand.actions.canPlay} canHide={hand.actions.canHide} envido={hand.envido} onPlay={actions.playCard} />}
          </div>
          {me && (
            <div className="flex w-14 flex-col items-center gap-1 sm:w-24">
              <div className={cn('relative rounded-full p-0.5 ring-3', TEAM_TONE.us.ring, myTurn && trucoStyles.turn)}>
                <div className="flex size-11 items-end justify-center overflow-hidden rounded-full bg-violet-950/70 sm:size-14">
                  <Avatar id={me.userId} character={me.character} className="w-[85%] translate-y-[6%]" />
                </div>
                {match?.mano === mySeat && (
                  <span title="Você é mão" className="absolute -right-1 -bottom-1 flex size-5 items-center justify-center rounded-full bg-white text-[10px] font-black text-slate-900 shadow">
                    M
                  </span>
                )}
              </div>
              <span className="max-w-full truncate text-xs font-semibold text-emerald-200">{me.nickname}</span>
            </div>
          )}
        </div>
      </footer>

      {state.phase === 'FINISHED' && state.result && (
        <ResultPanel result={state.result} myTeam={myTeam} target={state.settings.target} solo={size === 2} onRematch={actions.rematch} onLeave={actions.leave} />
      )}
    </div>
  );
}

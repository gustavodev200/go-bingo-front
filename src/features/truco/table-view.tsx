'use client';

import { LogOut } from 'lucide-react';
import { teamOf, type Seat, type TrucoPrivateHand, type TrucoRoomState } from '@/contracts';
import { Avatar } from '@/components/stage/avatar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { SoundToggle } from '@/features/game/sound-toggle';
import { NarrationToggle } from '@/features/game/sound/narration-toggle';
import { cn } from '@/lib/utils';
import { ActionBar } from './action-bar';
import type { TrucoActions } from './connection';
import { MyHand } from './my-hand';
import { ResultPanel } from './result-panel';
import { availableActions, positionOf, type TablePosition } from './rules-view';
import { Scoreboard } from './scoreboard';
import { SeatBadge, TEAM_TONE } from './seat-badge';
import { RoundBanner, ShoutOverlay } from './shout-overlay';
import { SignalPicker } from './signal-picker';
import type { Conventions } from './signals';
import { useTrucoStore } from './store';
import { TableCenter } from './table-center';
import { TentoPiles } from './tento-piles';
import styles from './truco.module.css';

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

/** The 2D table: four seats, the cards in the middle, the scoreboard and the player's hand and actions. */
export function TableView({
  state,
  mySeat,
  hand,
  actions,
  conventions,
  audio,
  onSignalSent,
}: {
  state: TrucoRoomState;
  mySeat: Seat;
  hand: TrucoPrivateHand | null;
  actions: TrucoActions;
  conventions: Conventions;
  audio: AudioControls;
  onSignalSent(gesture: Parameters<TrucoActions['signal']>[0]): void;
}) {
  const effects = useTrucoStore((s) => s.effects);
  const match = state.match;
  const myTeam = teamOf(mySeat);
  const me = state.seats[mySeat];
  const available = availableActions(state, mySeat);
  const gestureFor = (seat: Seat) => effects.findLast((e) => e.kind === 'gesture' && e.seat === seat) as Extract<(typeof effects)[number], { kind: 'gesture' }> | undefined;
  const turnPlayer = match ? state.seats[match.turn] : null;
  const myGesture = gestureFor(mySeat);

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden bg-[radial-gradient(ellipse_at_top,#4c1d95,#1e0b3d_70%)]">
      <header className="flex items-center gap-2 px-2 pt-[calc(0.5rem+env(safe-area-inset-top))] pb-1 sm:px-4">
        <Scoreboard scores={state.scores} myTeam={myTeam} match={match} />
        <div className="flex flex-col gap-1 sm:flex-row">
          <SoundToggle muted={!audio.sfx} onChange={(muted) => audio.setSfx(!muted)} />
          <NarrationToggle enabled={audio.voice} onChange={audio.setVoice} />
        </div>
        <LeaveButton playing={state.phase === 'PLAYING'} onLeave={actions.leave} />
      </header>

      <div className="relative min-h-0 flex-1 px-2 py-1 sm:px-6">
        <div className={cn(styles.felt, 'relative mx-auto h-full w-full max-w-4xl rounded-[clamp(20px,min(8vw,10dvh),72px)] [container-type:size]')}>
          {match && <TentoPiles scores={state.scores} mySeat={mySeat} />}
          {([1, 2, 3] as const).map((offset) => {
            const seat = ((mySeat + offset) % 4) as Seat;
            const player = state.seats[seat];
            const pos = positionOf(seat, mySeat) as Exclude<TablePosition, 'bottom'>;
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
                  ours={teamOf(seat) === myTeam}
                  isTurn={!!match && match.turn === seat && state.phase === 'PLAYING' && match.phase !== 'HAND_OVER'}
                  isDealer={match?.dealer === seat}
                  isHost={state.hostId === player.userId}
                  cardsLeft={match && state.phase === 'PLAYING' ? match.cardsLeft[seat] : 0}
                  gesture={gestureFor(seat) ?? null}
                  conventions={conventions}
                />
              </div>
            );
          })}
          <TableCenter state={state} mySeat={mySeat} />
          <RoundBanner />
          <ShoutOverlay />
        </div>
      </div>

      <footer className="relative flex flex-col gap-1 px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] sm:px-4">
        <ActionBar
          actions={available}
          partnerCards={hand?.partnerCards ?? null}
          onRequestBet={actions.requestBet}
          onRespond={actions.respondBet}
          onDecideTen={actions.decideTen}
          turnName={turnPlayer?.nickname ?? null}
        />
        <div className="flex items-end justify-between gap-2">
          <div className="flex w-16 flex-col items-center gap-1 sm:w-24">
            <SignalPicker
              conventions={conventions}
              onSend={async (gesture) => {
                if (await actions.signal(gesture)) onSignalSent(gesture);
              }}
            />
          </div>
          <div className="min-w-0 flex-1">{hand && state.phase === 'PLAYING' && <MyHand cards={hand.cards} canPlay={available.canPlay} onPlay={actions.playCard} />}</div>
          {me && (
            <div className="flex w-16 flex-col items-center gap-1 sm:w-24">
              <div className={cn('rounded-full p-0.5 ring-3', TEAM_TONE.us.ring, available.myTurn && styles.turn)}>
                <div key={myGesture?.id} className={cn('flex size-12 items-end justify-center overflow-hidden rounded-full bg-violet-950/70 sm:size-14', myGesture && styles.wiggle)}>
                  <Avatar id={me.userId} character={me.character} className="w-[85%] translate-y-[6%]" />
                </div>
              </div>
              <span className="max-w-full truncate text-xs font-semibold text-emerald-200">{me.nickname}</span>
            </div>
          )}
        </div>
      </footer>

      {state.phase === 'FINISHED' && state.result && <ResultPanel result={state.result} myTeam={myTeam} onRematch={actions.rematch} onLeave={actions.leave} />}
    </div>
  );
}

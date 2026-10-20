'use client';

import { Crown, Flag, LogOut, Maximize, Minimize, Smartphone, Smile, WifiOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import { tacadaRemaining, type TacadaGameView, type TacadaGroup, type TacadaRoomState, type TacadaSeatPlayer } from '@/contracts';
import { Avatar } from '@/components/stage/avatar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { SoundToggle } from '@/features/game/sound-toggle';
import { NarrationToggle } from '@/features/game/sound/narration-toggle';
import { useSecondsLeft } from '@/features/truco/seat-badge';
import { EmoteBubble } from '@/features/uno/opponent-seat';
import { EmoteBar } from '@/features/uno/pickers';
import { cn } from '@/lib/utils';
import type { AudioControls } from './audio';
import type { TacadaActions } from './connection';
import { PoolTable } from './pool-table';
import { MiniBall } from './mini-ball';
import { ResultPanel } from './result-panel';
import { GROUP_LABEL, POCKET_NAMES } from './rules-view';
import { Banner, ShoutOverlay } from './shout-overlay';
import { useTacadaStore, type TacadaEffect } from './store';
import styles from './tacada.module.css';

type Emote = Extract<TacadaEffect, { kind: 'emote' }> | null;

function GroupRack({ game, group, onEight }: { game: TacadaGameView; group: TacadaGroup | null; onEight: boolean }) {
  if (!group) return <span className="text-[11px] text-white/60">Mesa aberta</span>;
  const balls = group === 'solids' ? [1, 2, 3, 4, 5, 6, 7] : [9, 10, 11, 12, 13, 14, 15];
  const left = balls.filter((n) => game.balls[n] !== null).length;
  return (
    <span className="flex items-center gap-0.5" aria-label={`${GROUP_LABEL[group]}: ${onEight ? 'vai na 8' : `faltam ${left}`}`}>
      {balls.map((n) => (
        <MiniBall key={n} n={n} gone={game.balls[n] === null} className="size-3 sm:size-3.5" />
      ))}
      <MiniBall n={8} gone={!onEight} className={cn('ml-0.5 size-3 sm:size-3.5', onEight && 'ring-2 ring-amber-300')} />
    </span>
  );
}

function Clock({ deadline, readyAt }: { deadline: number | null; readyAt: number }) {
  const seconds = useSecondsLeft(deadline);
  const waiting = useSecondsLeft(readyAt);
  if (seconds === null || (waiting ?? 0) > 0) return null;
  return (
    <span
      role="timer"
      aria-label={`${seconds} segundos`}
      className={cn('rounded-md px-1.5 font-mono text-xs font-black tabular-nums shadow', seconds <= 7 ? 'bg-rose-500 text-white' : 'bg-amber-300 text-amber-950')}
    >
      {seconds}s
    </span>
  );
}

function PlayerPill({
  player,
  game,
  seat,
  active,
  me,
  isHost,
  emote,
  align,
}: {
  player: TacadaSeatPlayer | null;
  game: TacadaGameView | null;
  seat: number;
  active: boolean;
  me: boolean;
  isHost: boolean;
  emote: Emote;
  align: 'left' | 'right';
}) {
  const reconnect = useSecondsLeft(player?.reconnectDeadline ?? null);
  const group = game?.groups[seat] ?? null;
  const onEight = !!game && !!group && tacadaRemaining(game.balls, group) === 0;
  const fouls = game?.fouls[seat] ?? 0;
  return (
    <div
      className={cn(
        'flex min-w-0 flex-1 items-center gap-2 rounded-2xl bg-black/40 px-2 py-1 ring-2 backdrop-blur transition-colors',
        active ? 'ring-amber-300' : 'ring-white/10',
        align === 'right' && 'flex-row-reverse text-right',
      )}
      data-active={active || undefined}
    >
      <div className="relative shrink-0">
        {player && <EmoteBubble seat={player.seat} name={player.nickname} emote={emote} />}
        <div
          className={cn(
            'flex size-8 items-end justify-center overflow-hidden rounded-full bg-black/40 ring-2 sm:size-9',
            active ? 'ring-amber-300' : 'ring-white/30',
            active && styles.turn,
            player && !player.connected && 'opacity-50 grayscale',
          )}
        >
          {player && <Avatar id={player.userId} character={player.character} className="w-[85%] translate-y-[6%]" />}
        </div>
        {isHost && <Crown aria-label="Anfitrião" className="absolute -top-1.5 -left-1 size-3.5 fill-amber-300 text-amber-500" />}
      </div>
      <div className={cn('flex min-w-0 flex-1 flex-col gap-0.5', align === 'right' && 'items-end')}>
        <span className={cn('flex max-w-full items-center gap-1.5 text-xs font-bold text-white sm:text-sm', align === 'right' && 'flex-row-reverse')}>
          <span className="truncate">
            {player?.nickname ?? 'Saiu da mesa'}
            {me && <span className="text-amber-200"> (você)</span>}
          </span>
          {active && game && <Clock deadline={game.turnDeadline} readyAt={game.readyAt} />}
        </span>
        <span className={cn('flex items-center gap-1.5', align === 'right' && 'flex-row-reverse')}>
          {game && <GroupRack game={game} group={group} onEight={onEight} />}
          {fouls > 0 && (
            <span className="rounded-full bg-rose-500/85 px-1.5 text-[10px] font-bold text-white" aria-label={`${fouls} faltas seguidas`}>
              {fouls}/3
            </span>
          )}
          {player && !player.connected && (
            <span className="flex items-center gap-0.5 text-[10px] font-bold text-amber-300">
              <WifiOff aria-hidden className="size-3" /> {reconnect}s
            </span>
          )}
        </span>
      </div>
    </div>
  );
}

function ConfirmIcon({ label, icon, title, description, confirm, onConfirm }: { label: string; icon: React.ReactNode; title: string; description: string; confirm: string; onConfirm(): void }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="secondary" size="icon" className="size-9" aria-label={label}>
          {icon}
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

/** Fullscreen + landscape lock (Android); iOS ignores the lock and the rotate notice stays as the hint. */
async function goLandscape() {
  try {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen?.({ navigationUI: 'hide' });
    const orientation = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
    await orientation.lock?.('landscape');
  } catch {
    // Not supported (iOS Safari, desktop): the player turns the device by hand.
  }
}

function useFullscreen() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const sync = () => setOn(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);
  return on;
}

function RotateNotice() {
  return (
    <div className={cn(styles.rotate, 'fixed inset-0 z-50 flex-col items-center justify-center gap-5 bg-slate-950/95 p-6 text-center')} role="alert">
      <Smartphone aria-hidden className={cn('size-16 text-amber-300', styles.tilt)} />
      <h2 className="font-display text-marquee text-2xl font-bold">Gire o celular</h2>
      <p className="max-w-xs text-sm text-violet-100">A Tacada é jogada na horizontal: a mesa fica maior e a mira, mais precisa.</p>
      <Button size="lg" className="h-12 rounded-xl" onClick={() => void goLandscape()}>
        <Maximize aria-hidden /> Tela cheia na horizontal
      </Button>
    </div>
  );
}

/** The match: players on top, the table filling the screen sideways, power bar and spin on the sides. */
export function TableView({ state, mySeat, actions, audio }: { state: TacadaRoomState; mySeat: number; actions: TacadaActions; audio: AudioControls }) {
  const effects = useTacadaStore((s) => s.effects);
  const animating = useTacadaStore((s) => s.animating);
  const [emotesOpen, setEmotesOpen] = useState(false);
  const fullscreen = useFullscreen();
  const game = state.game;
  const other = 1 - mySeat;
  const playing = state.phase === 'PLAYING' && !!game;
  const myTurn = playing && game.turn === mySeat;
  const opponent = state.seats[other];
  const emoteOf = (seat: number): Emote => (effects.findLast((e) => e.kind === 'emote' && e.seat === seat) as Emote | undefined) ?? null;

  let status: React.ReactNode = null;
  if (playing && !animating) {
    if (myTurn) {
      const hint = game.breakShot
        ? 'Sua saída! Posicione a branca atrás da linha'
        : game.ballInHand
          ? 'Bola na mão: arraste a branca'
          : game.onEight
            ? 'Vá na 8: toque na caçapa e taque'
            : game.groups[mySeat]
              ? `Sua vez · ${GROUP_LABEL[game.groups[mySeat]!].toLowerCase()}`
              : 'Sua vez · mesa aberta';
      status = (
        <span key={`${game.shots}:${game.turn}`} className={cn('font-display rounded-full bg-amber-300 px-3 py-0.5 text-xs font-black text-amber-950 italic shadow sm:text-sm', styles.fadeOut)}>
          {hint}
        </span>
      );
    } else
      status = (
        <span key={`${game.shots}:${game.turn}`} className={cn('rounded-full bg-black/50 px-3 py-0.5 text-xs font-semibold text-white', styles.fadeOut)}>
          Vez de {opponent?.nickname ?? 'adversário'}
        </span>
      );
  }
  const lastPocketed = game?.lastShot?.pocketed.filter((n) => n !== 0) ?? [];

  return (
    <div className={cn('relative flex h-dvh flex-col overflow-hidden select-none', styles.backdrop)}>
      <header className="flex items-center gap-1.5 px-2 pt-[calc(0.35rem+env(safe-area-inset-top))] pb-1 sm:gap-2 sm:px-4">
        <span className="font-display hidden rounded-xl border-2 border-white bg-emerald-800 px-2 text-base font-black text-amber-200 shadow md:inline">Tacada</span>
        <PlayerPill player={state.seats[mySeat]} game={game} seat={mySeat} active={myTurn} me isHost={state.hostId === state.seats[mySeat]?.userId} emote={emoteOf(mySeat)} align="left" />
        <PlayerPill
          player={opponent}
          game={game}
          seat={other}
          active={playing && game.turn === other}
          me={false}
          isHost={!!opponent && state.hostId === opponent.userId}
          emote={emoteOf(other)}
          align="right"
        />
        <div className="flex shrink-0 items-center gap-1">
          <div className="relative">
            {emotesOpen ? (
              <div className="absolute top-full right-0 z-40 mt-1">
                <EmoteBar
                  onSend={(emote) => {
                    setEmotesOpen(false);
                    void actions.emote(emote);
                  }}
                />
              </div>
            ) : null}
            <Button variant="secondary" size="icon" className="size-9" aria-label="Reagir" onClick={() => setEmotesOpen((o) => !o)}>
              <Smile aria-hidden />
            </Button>
          </div>
          <span className="hidden sm:contents">
            <SoundToggle muted={!audio.sfx} onChange={(muted) => audio.setSfx(!muted)} />
            <NarrationToggle enabled={audio.voice} onChange={audio.setVoice} />
          </span>
          <Button
            variant="secondary"
            size="icon"
            className="size-9 lg:hidden"
            aria-label={fullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
            onClick={() => (fullscreen ? void document.exitFullscreen() : void goLandscape())}
          >
            {fullscreen ? <Minimize aria-hidden /> : <Maximize aria-hidden />}
          </Button>
          {playing && (
            <ConfirmIcon
              label="Desistir"
              icon={<Flag aria-hidden />}
              title="Desistir da partida?"
              description="Desistir conta como derrota. O adversário leva a vitória."
              confirm="Desistir"
              onConfirm={() => void actions.resign()}
            />
          )}
          {state.phase === 'PLAYING' ? (
            <ConfirmIcon
              label="Sair da mesa"
              icon={<LogOut aria-hidden />}
              title="Sair da partida?"
              description="Sair no meio conta como derrota e paga multa na Arena."
              confirm="Sair da partida"
              onConfirm={() => void actions.leave()}
            />
          ) : (
            <Button variant="secondary" size="icon" className="size-9" aria-label="Sair da mesa" onClick={() => void actions.leave()}>
              <LogOut aria-hidden />
            </Button>
          )}
        </div>
      </header>

      <div className="relative mx-auto flex min-h-0 w-full max-w-[110rem] flex-1 px-1 pb-[calc(0.4rem+env(safe-area-inset-bottom))] sm:px-3">
        {game && <PoolTable game={game} rules={state.rules} phase={state.phase} mySeat={mySeat} actions={actions} sound={audio.sfx} />}
        <div role="status" className="pointer-events-none absolute inset-x-0 top-1 z-20 flex flex-col items-center gap-1 px-16 text-center">
          {status}
          {playing && !animating && game.onEight && myTurn && <span className="sr-only">Caçapas: {POCKET_NAMES.join(', ')}</span>}
          {!animating && lastPocketed.length > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-black/45 px-2 py-0.5 text-[11px] text-white/85" aria-label={`Caíram: ${lastPocketed.join(', ')}`}>
              Caíram{' '}
              {lastPocketed.map((n) => (
                <MiniBall key={n} n={n} />
              ))}
            </span>
          )}
        </div>
        <Banner />
        <ShoutOverlay />
      </div>

      {state.phase === 'FINISHED' && state.result && !animating && <ResultPanel state={state} mySeat={mySeat} onRematch={actions.rematch} onLeave={actions.leave} />}
      <RotateNotice />
    </div>
  );
}

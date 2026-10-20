'use client';

import { Crown, LogOut, Shield, Smile, WifiOff } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { BJ_DEALER_CARD_MS, bjSurrenderAllowed, type BjAction, type BjGameView, type BjPlayerView, type BjRoomState, type BjSeatPlayer } from '@/contracts';
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
import { BetChip, BetPanel } from './chips';
import type { BjActions } from './connection';
import { DealerView, HandView } from './hand';
import { ResultPanel } from './result-panel';
import { ACTION_HINT, ACTION_LABEL, fmtChips, stackOf } from './rules-view';
import { Banner, ShoutOverlay } from './shout-overlay';
import { useBjStore, type BjEffect } from './store';
import styles from './blackjack.module.css';

type Emote = Extract<BjEffect, { kind: 'emote' }> | null;

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
          <DialogDescription>Você perde o que está apostado e fica em último. Com outros jogadores na mesa, conta como abandono na Arena.</DialogDescription>
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
  return (
    <span
      role="timer"
      aria-label={`${seconds} segundos`}
      className={cn('rounded-lg px-2 py-0.5 font-mono text-sm font-black tabular-nums shadow', seconds <= 5 ? 'bg-rose-500 text-white' : 'bg-amber-300 text-amber-950')}
    >
      {seconds}s
    </span>
  );
}

/** Small status pill under a seat: what the player is doing in this stage. */
function seatStatus(game: BjGameView, p: BjPlayerView): string | null {
  if (p.left) return 'Saiu';
  if (p.broke) return 'Sem fichas';
  if (game.stage === 'BETTING') return p.bet === null ? 'Apostando…' : null;
  if (game.stage === 'INSURANCE') return p.insurance === null ? 'Decidindo o seguro…' : p.insurance > 0 ? 'Com seguro' : null;
  return null;
}

/** Another player at the table: compact, cards small. */
function OtherSeat({ game, seat, player, isHost, emote }: { game: BjGameView; seat: BjPlayerView; player: BjSeatPlayer | null; isHost: boolean; emote: Emote }) {
  const reconnect = useSecondsLeft(player?.reconnectDeadline ?? null);
  const onTurn = game.turn?.seat === seat.seat;
  const status = seatStatus(game, seat);
  const name = player?.nickname ?? 'Saiu';
  return (
    <li
      className={cn(
        'relative flex min-h-16 min-w-0 items-center gap-1.5 rounded-2xl bg-black/25 p-1.5 ring-2 transition-colors',
        onTurn ? 'ring-amber-300' : 'ring-white/10',
        seat.left && 'opacity-50',
      )}
      aria-label={`${name}, ${fmtChips(seat.chips)} fichas`}
    >
      <div className="flex w-14 shrink-0 flex-col items-center gap-0.5 text-center leading-tight">
        <div className="relative">
          {player && <EmoteBubble seat={seat.seat} name={player.nickname} emote={emote} />}
          <div
            className={cn(
              'flex size-8 items-end justify-center overflow-hidden rounded-full bg-black/40 ring-2',
              onTurn ? 'ring-amber-300' : 'ring-white/30',
              onTurn && styles.turn,
              player && !player.connected && 'opacity-50 grayscale',
            )}
          >
            {player && <Avatar id={player.userId} character={player.character} className="w-[85%] translate-y-[6%]" />}
          </div>
          {isHost && <Crown aria-label="Anfitrião" className="absolute -top-1.5 -left-1 size-3.5 fill-amber-300 text-amber-500" />}
        </div>
        <span className="w-full truncate text-[11px] font-bold text-white">{name}</span>
        <span className="text-[11px] font-semibold text-amber-200 tabular-nums">{fmtChips(stackOf(seat))}</span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col items-center gap-0.5">
        <div className="flex flex-wrap items-end justify-center gap-0.5">
          {seat.hands.map((h, i) => (
            <HandView key={i} hand={h} size="xs" compact active={onTurn && game.turn?.hand === i} revealDelay={dealerRevealMs(game)} label={`Mão ${i + 1} de ${name}`} />
          ))}
          {seat.hands.length === 0 && seat.bet !== null && <BetChip amount={seat.bet} />}
        </div>
        {(status || (player && !player.connected)) && (
          <span className="flex items-center gap-1 text-[10px] font-bold text-white/80">
            {player && !player.connected && (
              <span className="flex items-center gap-0.5 text-amber-300">
                <WifiOff aria-hidden className="size-3" /> {reconnect}s
              </span>
            )}
            {status}
          </span>
        )}
      </div>
    </li>
  );
}

/** When the round closes, the outcome badges wait for the dealer's draws to finish animating. */
function dealerRevealMs(game: BjGameView): number {
  if (game.stage !== 'SETTLED') return 0;
  return Math.max(0, game.dealer.cards.length - 2) * BJ_DEALER_CARD_MS + 250;
}

/** The printed arc on the felt with the table rules. Decorative. */
function FeltPrint({ payout, surrender }: { payout: string; surrender: boolean }) {
  return (
    <svg aria-hidden viewBox="0 0 400 90" className={cn(styles.feltPrint, 'pointer-events-none -mt-1 w-[min(100%,30rem)] max-lg:max-h-14')}>
      <path id="bj-arc" d="M 30 20 Q 200 95 370 20" className={styles.printLine} />
      <text className={styles.print} fontSize="15">
        <textPath href="#bj-arc" startOffset="50%" textAnchor="middle">
          BLACKJACK PAGA {payout.replace(':', ' PARA ')}
        </textPath>
      </text>
      <text x="200" y="82" textAnchor="middle" className={styles.print} fontSize="8.5">
        DEALER PARA EM 17 · SEGURO PAGA 2 PARA 1{surrender ? ' · RENDER' : ''}
      </text>
    </svg>
  );
}

/** Controls for the current stage: the bet panel, the insurance question or the moves. */
function Controls({ state, mySeat, actions }: { state: BjRoomState; mySeat: number; actions: BjActions }) {
  const { busy, run } = useBusy();
  const [lastBet, setLastBet] = useState<number | null>(null);
  const game = state.game!;
  const me = game.players[mySeat];
  if (!me) return null;
  const myTurn = game.turn?.seat === mySeat;
  const turnName = game.turn ? (state.seats[game.turn.seat]?.nickname ?? 'alguém') : null;

  if (me.broke) return <Hint>Você ficou sem fichas. Assista até o fim da partida.</Hint>;
  if (game.stage === 'BETTING') {
    if (me.bet !== null)
      return (
        <Hint clock={game.deadline}>
          Aposta de <BetChip amount={me.bet} /> feita. Esperando a mesa…
        </Hint>
      );
    return (
      <>
        <Hint clock={game.deadline}>Faça sua aposta</Hint>
        <BetPanel
          chips={me.chips}
          lastBet={lastBet}
          busy={busy}
          onBet={(amount) =>
            void run(async () => {
              if (await actions.bet(amount)) setLastBet(amount);
            })()
          }
        />
      </>
    );
  }
  if (game.stage === 'INSURANCE') {
    if (me.insurance !== null) return <Hint clock={game.deadline}>{me.insurance > 0 ? 'Seguro feito.' : 'Sem seguro.'} Esperando a mesa…</Hint>;
    const cost = (me.bet ?? 0) / 2;
    return (
      <div className="flex w-full max-w-md flex-col items-center gap-2" role="group" aria-label="Seguro">
        <Hint clock={game.deadline}>
          <Shield aria-hidden className="size-4" /> O dealer mostra um Ás. Seguro por {fmtChips(cost)}? (paga 2 para 1)
        </Hint>
        <div className="grid w-full grid-cols-2 gap-2">
          <Button size="lg" variant="secondary" className="h-12 rounded-xl text-base" disabled={busy} onClick={run(() => actions.insurance(false))}>
            Não, obrigado
          </Button>
          <Button size="lg" className="h-12 rounded-xl text-base" disabled={busy} onClick={run(() => actions.insurance(true))}>
            Fazer seguro
          </Button>
        </div>
      </div>
    );
  }
  if (game.stage === 'PLAYING') {
    if (!myTurn) return <Hint clock={game.deadline}>Vez de {turnName}</Hint>;
    const order: BjAction[] = ['hit', 'stand', 'double', 'split', 'surrender'];
    const available = new Set(game.actions);
    return (
      <div className="flex w-full max-w-lg flex-col items-center gap-2" role="group" aria-label="Sua jogada">
        <Hint clock={game.deadline}>
          <span className={cn('font-display rounded-full bg-amber-300 px-3 py-0.5 font-black text-amber-950 italic shadow', styles.pulse)}>Sua vez!</span>
          {me.hands.length > 1 && (
            <span className="text-xs">
              Mão {game.turn!.hand + 1} de {me.hands.length}
            </span>
          )}
        </Hint>
        <div className={styles.actions}>
          {order
            .filter((a) => a !== 'surrender' || bjSurrenderAllowed(state.rules))
            .map((a) => (
              <Button
                key={a}
                size="lg"
                variant={a === 'hit' || a === 'stand' ? 'default' : 'outline'}
                className={cn(
                  'flex h-auto min-h-12 flex-col gap-0 rounded-xl py-1.5 text-base leading-tight',
                  a === 'stand' && 'from-rose-300 to-rose-600 text-white [--primary-shadow:var(--color-rose-800)]',
                  a === 'surrender' && 'col-span-2 min-h-10 sm:col-span-1 [@media(orientation:landscape)_and_(max-height:640px)]:col-span-1',
                )}
                disabled={busy || !available.has(a)}
                onClick={run(() => actions.act(a))}
              >
                <span className="font-black">{ACTION_LABEL[a]}</span>
                <span className={cn(styles.hint, 'text-[11px] font-medium opacity-80')}>{ACTION_HINT[a]}</span>
              </Button>
            ))}
        </div>
      </div>
    );
  }
  // SETTLED: the round result, then the next round starts by itself.
  const net = me.roundNet;
  return (
    <Hint clock={game.round < state.rules.rounds ? game.deadline : null}>
      {net > 0 ? `Você ganhou ${fmtChips(net)} fichas` : net < 0 ? `Você perdeu ${fmtChips(-net)} fichas` : 'Rodada empatada'}
      {game.round < state.rules.rounds ? ' · próxima rodada em' : ' · última rodada'}
    </Hint>
  );
}

function Hint({ children, clock = null }: { children: ReactNode; clock?: number | null }) {
  return (
    <div role="status" className="flex min-h-9 flex-wrap items-center justify-center gap-2 text-center text-sm font-bold text-white drop-shadow">
      {children}
      <Clock deadline={clock} />
    </div>
  );
}

/**
 * The match: the dealer on top, the other players in a row (a side column
 * on wide screens), my hands big at the bottom with the controls.
 */
export function TableView({ state, mySeat, actions, audio }: { state: BjRoomState; mySeat: number; actions: BjActions; audio: AudioControls }) {
  const effects = useBjStore((s) => s.effects);
  const [emotesOpen, setEmotesOpen] = useState(false);
  const game = state.game;
  const emoteOf = (seat: number): Emote => (effects.findLast((e) => e.kind === 'emote' && e.seat === seat) as Emote | undefined) ?? null;
  const me = game?.players[mySeat] ?? null;
  const others = game ? game.players.filter((p): p is BjPlayerView => p !== null && p.seat !== mySeat) : [];
  const myTurn = !!game && game.turn?.seat === mySeat;
  const reveal = game ? dealerRevealMs(game) : 0;

  return (
    <div className={cn('relative flex h-dvh flex-col overflow-hidden', styles.backdrop)}>
      <header className="flex items-center gap-2 px-2 pt-[calc(0.5rem+env(safe-area-inset-top))] pb-1 sm:px-4">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="font-display rounded-xl border-2 border-white bg-emerald-950 px-2 text-lg font-black text-amber-200 shadow">21</span>
          {game && (
            <span className="truncate rounded-full bg-black/35 px-3 py-1 text-xs font-semibold text-white">
              Rodada {game.round}/{state.rules.rounds} · sapato {Math.round((game.shoeLeft / game.shoeSize) * 100)}%
            </span>
          )}
        </div>
        <div className="flex gap-1">
          <SoundToggle muted={!audio.sfx} onChange={(muted) => audio.setSfx(!muted)} />
          <NarrationToggle enabled={audio.voice} onChange={audio.setVoice} />
        </div>
        <LeaveButton playing={state.phase === 'PLAYING'} onLeave={actions.leave} />
      </header>

      <div className={styles.layout}>
        <section className={cn(styles.areaDealer, styles.felt, 'relative flex min-h-[calc(clamp(30px,min(9vw,6.4dvh),54px)*1.4+2.5rem)] flex-col items-center gap-1 pt-1')} aria-label="Dealer">
          <span className="text-[11px] font-black tracking-[0.3em] text-amber-200/80 uppercase">Dealer</span>
          {game && <DealerView dealer={game.dealer} size="sm" />}
          {game && <FeltPrint payout={state.rules.payout} surrender={bjSurrenderAllowed(state.rules)} />}
        </section>

        <section className={styles.areaOthers} aria-label="Outros jogadores">
          {others.length > 0 && (
            <ul className={styles.others} data-many={others.length > 2 || undefined}>
              {others.map((p) => (
                <OtherSeat key={p.seat} game={game!} seat={p} player={state.seats[p.seat]} isHost={state.seats[p.seat]?.userId === state.hostId} emote={emoteOf(p.seat)} />
              ))}
            </ul>
          )}
          {others.length === 0 && <p className="hidden text-center text-sm text-white/60 lg:block">Treino: só você contra o dealer. Com mais gente na mesa, vence quem terminar com mais fichas.</p>}
        </section>

        <section className={cn(styles.areaMe, 'relative flex flex-col items-center justify-end gap-1 lg:justify-center')} aria-label="Sua mão">
          <Banner />
          <ShoutOverlay />
          {me && (
            <>
              <div className="relative flex flex-wrap items-end justify-center gap-3">
                {state.seats[mySeat] && <EmoteBubble seat={mySeat} name={state.seats[mySeat]!.nickname} emote={emoteOf(mySeat)} />}
                {me.hands.map((h, i) => (
                  <HandView key={i} hand={h} size="md" active={myTurn && game!.turn?.hand === i} revealDelay={reveal} label={me.hands.length > 1 ? `Sua mão ${i + 1}` : 'Sua mão'} />
                ))}
                {me.hands.length === 0 && me.bet !== null && <BetChip amount={me.bet} className="text-base" />}
              </div>
              <div className={cn('flex items-center gap-2 rounded-full bg-black/40 px-3 py-1 ring-2', myTurn ? 'ring-amber-300' : 'ring-white/10')}>
                <span className="text-xs font-semibold text-white/80">{state.seats[mySeat]?.nickname ?? 'Você'}</span>
                <span className="text-sm font-black text-amber-200 tabular-nums" aria-label={`${me.chips} fichas`}>
                  {fmtChips(me.chips)} fichas
                </span>
                {me.insurance ? <span className="rounded-full bg-sky-400 px-1.5 text-[10px] font-black text-sky-950">SEGURO {me.insurance}</span> : null}
              </div>
            </>
          )}
        </section>

        <div className={cn(styles.areaBar, 'flex flex-col items-center gap-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]')}>
          {game && state.phase === 'PLAYING' && <Controls state={state} mySeat={mySeat} actions={actions} />}
          {state.phase === 'PLAYING' && (
            <div className="relative self-end">
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
          )}
        </div>
      </div>

      {state.phase === 'FINISHED' && state.result && <ResultPanel state={state} mySeat={mySeat} onRematch={actions.rematch} onLeave={actions.leave} />}
    </div>
  );
}

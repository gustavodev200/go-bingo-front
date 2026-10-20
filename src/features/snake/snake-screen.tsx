'use client';

import { ChevronLeft, ChevronRight, Copy, Crown, DoorOpen, Globe, Loader2, Lock, Share2, Volume2, VolumeX, X, Zap } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import { CPU_WIN_COINS, SNAKE_CPU_FILL, SNAKE_FIRST_TEAM_SKIN, SNAKE_MAX_PLAYERS, SNAKE_MIN_PLAYERS, SNAKE_SKIN_NAMES, SNAKE_SKINS, snakeViewScaleFor, type SnakeRoomState } from '@/contracts';
import { Coins } from '@/components/stage/coin';
import { Button } from '@/components/ui/button';
import { ConnectionBanner } from '@/features/game/connection-banner';
import { useProfile } from '@/features/profile/profile-context';
import { cn } from '@/lib/utils';
import { useSnakeRoom, type SnakeActions } from './connection';
import { SnakeInput, type PadLike } from './input';
import { isMuted, sfx, toggleMute, unlockAudio } from './media/audio';
import { drawMinimap, drawSkinPreview, initialQuality, QualityGovernor, qualityFor, SnakeRenderer } from './media/renderer';
import { useSnakeStore, type SnakeDeath, type SnakeExit } from './store';
import { SnakeView } from './view';

/** World units across the longer screen side at the closest zoom. */
const BASE_VIEW = 1200;
const SPECTATE_ZOOM = 0.85;
const INPUT_MIN_MS = 33;
const INPUT_KEEPALIVE_MS = 250;
const DEATH_DELAY_MS = 1100;
const SKIN_KEY = 'snake.skin';
const BEST_KEY = 'snake.best';

function readNumber(key: string, fallback: number): number {
  try {
    const v = Number(localStorage.getItem(key));
    return Number.isFinite(v) && localStorage.getItem(key) !== null ? v : fallback;
  } catch {
    return fallback;
  }
}
function writeNumber(key: string, v: number) {
  try {
    localStorage.setItem(key, String(v));
  } catch {
    // private mode: not remembered
  }
}

const pads = (): readonly (PadLike | null)[] => (typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : []);

/** Left: floating stick (touch anywhere on the left side). Right: boost button. */
function TouchControls({ input }: { input: SnakeInput }) {
  const [origin, setOrigin] = useState<{
    x: number;
    y: number;
    id: number;
  } | null>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const [boosting, setBoosting] = useState(false);
  const R = 42;
  /** Half the base (56 px) plus a margin: the base never sits against an edge. */
  const EDGE = 76;

  const down = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (origin) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const box = e.currentTarget.getBoundingClientRect();
    const clamp = (v: number, size: number) => Math.min(Math.max(v, EDGE), Math.max(EDGE, size - EDGE));
    setOrigin({
      x: clamp(e.clientX - box.left, box.width),
      y: clamp(e.clientY - box.top, box.height),
      id: e.pointerId,
    });
    setKnob({ x: 0, y: 0 });
  };
  const move = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!origin || e.pointerId !== origin.id) return;
    const box = e.currentTarget.getBoundingClientRect();
    const dx = e.clientX - box.left - origin.x;
    const dy = e.clientY - box.top - origin.y;
    const len = Math.hypot(dx, dy);
    const k = len > R ? R / len : 1;
    setKnob({ x: dx * k, y: dy * k });
    if (len > 6) input.setTouchAngle(Math.atan2(dy, dx));
  };
  const up = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!origin || e.pointerId !== origin.id) return;
    setOrigin(null);
    setKnob({ x: 0, y: 0 });
    input.setTouchAngle(null);
  };
  const boost = (on: boolean) => (e: ReactPointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    input.setTouchBoost(on);
    setBoosting(on);
    if (on) navigator.vibrate?.(10);
  };

  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex justify-between">
      <div
        role="presentation"
        aria-label="Analógico"
        className="pointer-events-auto relative h-full w-[55%] touch-none"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
      >
        <div
          className={cn('absolute size-28 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/30 bg-white/10 transition-opacity', origin ? 'opacity-95' : 'opacity-55')}
          style={
            origin
              ? { left: origin.x, top: origin.y }
              : {
                  left: 'calc(7rem + env(safe-area-inset-left))',
                  top: 'calc(100% - 5.25rem - env(safe-area-inset-bottom))',
                }
          }
        >
          <div
            className="absolute top-1/2 left-1/2 size-13 rounded-full bg-[radial-gradient(circle_at_35%_30%,#fff,#b8c6ff)] shadow-[0_4px_14px_rgb(0_0_0/0.4)]"
            style={{
              transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))`,
            }}
          />
        </div>
      </div>
      <div className="pointer-events-auto relative h-full w-[45%] touch-none">
        <button
          type="button"
          aria-label="Impulso"
          aria-pressed={boosting}
          onPointerDown={boost(true)}
          onPointerUp={boost(false)}
          onPointerCancel={boost(false)}
          onPointerLeave={boost(false)}
          className={cn(
            'absolute right-[calc(2rem+env(safe-area-inset-right))] bottom-[calc(1.75rem+env(safe-area-inset-bottom))] grid size-24 place-items-center rounded-full bg-[radial-gradient(circle_at_35%_30%,#fff4b8,#ffd23f_55%,#e09b00)] text-amber-950 shadow-[0_6px_0_#9a6a00] transition',
            boosting && 'translate-y-1 shadow-[0_2px_0_#9a6a00,0_0_30px_rgb(255_210_63/0.9)]',
          )}
        >
          <Zap aria-hidden className="size-10 fill-current" />
        </button>
      </div>
    </div>
  );
}

function SkinPicker({ skin, onChange }: { skin: number; onChange: (skin: number) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv?.getContext('2d')) return;
    let raf = 0;
    const loop = (t: number) => {
      drawSkinPreview(cv, skin, t);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [skin]);
  const n = SNAKE_SKINS.length;
  const isTeam = skin >= SNAKE_FIRST_TEAM_SKIN;
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div role="group" aria-label="Tipo de skin" className="flex gap-1.5 text-xs font-bold">
        {[
          { label: 'Neon', active: !isTeam, to: 0 },
          { label: '⚽ Times', active: isTeam, to: SNAKE_FIRST_TEAM_SKIN },
        ].map((t) => (
          <button
            key={t.label}
            type="button"
            aria-pressed={t.active}
            onClick={() => !t.active && onChange(t.to)}
            className={cn('rounded-full px-3 py-1', t.active ? 'bg-green-400 text-green-950' : 'bg-white/10 text-white hover:bg-white/20')}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="flex items-center justify-center gap-2">
        <Button type="button" variant="secondary" size="icon" className="size-11 rounded-full" aria-label="Skin anterior" onClick={() => onChange((skin + n - 1) % n)}>
          <ChevronLeft aria-hidden />
        </Button>
        <canvas ref={ref} width={260} height={80} aria-label={`Skin ${SNAKE_SKIN_NAMES[skin]} (${skin + 1} de ${n})`} role="img" className="h-17 w-55 rounded-2xl bg-black/30" />
        <Button type="button" variant="secondary" size="icon" className="size-11 rounded-full" aria-label="Próxima skin" onClick={() => onChange((skin + 1) % n)}>
          <ChevronRight aria-hidden />
        </Button>
      </div>
      <span className="text-sm font-bold" aria-live="polite">
        {SNAKE_SKIN_NAMES[skin]}
      </span>
    </div>
  );
}

/** Room code to share, who is in, visibility (host) and the way out. */
function RoomPanel({ room, actions }: { room: SnakeRoomState; actions: SnakeActions }) {
  const { profile } = useProfile();
  const isHost = room.hostId === profile.id;
  const [copied, setCopied] = useState(false);
  async function share() {
    const url = `${window.location.origin}/snake/${room.code}`;
    try {
      if (navigator.share) await navigator.share({ title: 'Snake.io', text: `Bora jogar Snake.io! Sala ${room.code}`, url });
      else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
      }
    } catch {
      /* share sheet closed */
    }
  }
  return (
    <section aria-label="Sala" className="flex flex-col gap-2 rounded-2xl bg-black/30 p-3 text-left">
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground text-xs font-bold uppercase">Sala</span>
        <b className="font-mono text-lg tracking-[0.25em]">{room.code}</b>
        <button type="button" aria-label="Compartilhar sala" onClick={() => void share()} className="grid size-8 place-items-center rounded-full bg-white/10 hover:bg-white/20">
          {typeof navigator !== 'undefined' && 'share' in navigator ? <Share2 aria-hidden className="size-4" /> : <Copy aria-hidden className="size-4" />}
        </button>
        {copied && <span className="text-xs text-green-400">Link copiado!</span>}
        <span className="ml-auto text-sm font-bold text-amber-200 tabular-nums">
          {room.players.length}/{SNAKE_MAX_PLAYERS}
        </span>
      </div>
      <ul aria-label="Jogadores na sala" className="flex max-h-24 flex-wrap gap-1.5 overflow-y-auto">
        {room.players.map((p) => (
          <li key={p.userId} className={cn('flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-xs font-semibold', !p.connected && 'opacity-50')}>
            {p.userId === room.hostId && <Crown aria-label="Anfitrião" className="size-3 text-amber-300" />}
            <span aria-hidden className={cn('size-1.5 rounded-full', p.playing ? 'bg-green-400' : 'bg-slate-400')} />
            {p.nickname}
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        {isHost ? (
          <Button type="button" variant="secondary" size="sm" className="flex-1 gap-1.5 rounded-xl" onClick={() => void actions.setVisibility(!room.isPublic)}>
            {room.isPublic ? <Globe aria-hidden className="size-4" /> : <Lock aria-hidden className="size-4" />}
            {room.isPublic ? 'Pública' : 'Privada'}
          </Button>
        ) : (
          <span className="text-muted-foreground flex flex-1 items-center gap-1.5 text-xs">
            {room.isPublic ? <Globe aria-hidden className="size-4" /> : <Lock aria-hidden className="size-4" />}
            {room.isPublic ? 'Sala pública' : 'Sala privada'}
          </span>
        )}
        <Button type="button" variant="secondary" size="sm" className="flex-1 gap-1.5 rounded-xl" onClick={() => void actions.leave()}>
          <DoorOpen aria-hidden className="size-4" /> Sair da sala
        </Button>
      </div>
    </section>
  );
}

function Menu({
  skin,
  setSkin,
  onPlay,
  busy,
  error,
  room,
  actions,
}: {
  skin: number;
  setSkin: (s: number) => void;
  onPlay: () => void;
  busy: boolean;
  error: string | null;
  room: SnakeRoomState;
  actions: SnakeActions;
}) {
  const { profile } = useProfile();
  const best = readNumber(BEST_KEY, 0);
  const online = onlineOf(room);
  const waiting = online < SNAKE_MIN_PLAYERS;
  return (
    <div className="absolute inset-0 z-20 flex overflow-y-auto bg-[radial-gradient(ellipse_at_center,rgb(13_18_36/0.35),rgb(13_18_36/0.85))] p-4 [@media(max-height:500px)]:p-2">
      <div className="glass m-auto flex w-full max-w-sm flex-col gap-4 p-5 text-center [@media(max-height:500px)]:max-w-3xl [@media(max-height:500px)]:flex-row [@media(max-height:500px)]:p-3">
        <div className="flex flex-1 flex-col gap-4 [@media(max-height:500px)]:gap-2">
          <h1 className="font-display text-5xl font-bold tracking-wide [@media(max-height:500px)]:text-3xl">
            {['S', 'N', 'A', 'K', 'E'].map((c, i) => (
              <span key={c} className={['text-green-400', 'text-yellow-300', 'text-rose-400', 'text-sky-400', 'text-purple-400'][i]}>
                {c}
              </span>
            ))}
            <small className="text-muted-foreground ml-1 text-2xl">.io</small>
          </h1>
          <p className="text-muted-foreground -mt-2 text-sm">
            Jogando como <b className="text-white">{profile.nickname}</b>
          </p>
          <SkinPicker skin={skin} onChange={setSkin} />
          {waiting ? (
            <div role="status" className="flex flex-col gap-1 rounded-2xl border border-dashed border-white/20 p-3">
              <b className="font-display text-lg">
                Aguardando jogadores ({online}/{SNAKE_MIN_PLAYERS})
              </b>
              <span className="text-muted-foreground text-xs">A partida começa com pelo menos {SNAKE_MIN_PLAYERS} pessoas. Compartilhe o código da sala!</span>
            </div>
          ) : online < SNAKE_CPU_FILL ? (
            <p className="text-xs text-sky-200">
              Pouca gente na sala: cobras da CPU completam a arena. Derrubar uma CPU vale <Coins amount={CPU_WIN_COINS} className="align-middle" /> (sem ranking).
            </p>
          ) : null}
          <Button size="lg" className="h-14 rounded-2xl text-xl [@media(max-height:500px)]:h-11" disabled={busy || waiting} onClick={onPlay}>
            {busy ? <Loader2 aria-hidden className="animate-spin" /> : null}
            {busy ? 'Entrando…' : 'Jogar'}
          </Button>
          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}
        </div>
        <div className="flex flex-1 flex-col gap-4 [@media(max-height:500px)]:gap-2">
          <RoomPanel room={room} actions={actions} />
          {best > 0 && <p className="text-muted-foreground -mt-2 text-xs">🏆 Seu recorde: {best}</p>}
          <ul className="text-muted-foreground flex flex-col gap-1 text-left text-xs leading-relaxed [@media(max-height:500px)]:hidden">
            <li>
              <b className="text-white">Computador:</b> a cobra segue o mouse; segure o clique ou Espaço para o impulso. WASD/setas e controle também.
            </li>
            <li>
              <b className="text-white">Celular:</b> analógico à esquerda, ⚡ impulso à direita.
            </li>
            <li>Coma os pontos, faça os outros baterem no seu corpo e fuja da borda vermelha. O impulso gasta tamanho.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

const onlineOf = (room: SnakeRoomState) => room.players.filter((p) => p.connected).length;

function DeathCard({ death, bestBefore, onAgain, onMenu, busy, waiting }: { death: SnakeDeath; bestBefore: number; onAgain: () => void; onMenu: () => void; busy: boolean; waiting: boolean }) {
  const record = death.score > bestBefore;
  const time = death.secs >= 60 ? `${Math.floor(death.secs / 60)}m ${death.secs % 60}s` : `${death.secs}s`;
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="snake-death-title" className="absolute inset-0 z-20 flex overflow-y-auto bg-black/55 p-4 [@media(max-height:500px)]:p-2">
      <div className="glass m-auto flex w-full max-w-sm flex-col gap-3 p-5 text-center [@media(max-height:500px)]:max-w-xl [@media(max-height:500px)]:gap-2 [@media(max-height:500px)]:p-3">
        <h2 id="snake-death-title" className="font-display text-3xl font-bold text-rose-400 [@media(max-height:500px)]:text-2xl">
          {death.killer ? `Eliminado por ${death.killer}!` : 'Você bateu na borda!'}
        </h2>
        <dl className="grid grid-cols-2 gap-2 [@media(max-height:500px)]:grid-cols-4">
          {[
            ['Tamanho', death.score],
            ['Abates', death.kills],
            ['Posição', `#${death.rank}`],
            ['Tempo', time],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl bg-black/30 p-2">
              <dt className="text-muted-foreground text-[11px] font-bold tracking-wider uppercase">{label}</dt>
              <dd className="font-display text-2xl text-amber-300">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="text-muted-foreground text-sm">{record ? '🏆 Novo recorde pessoal!' : `Recorde: ${bestBefore}`}</p>
        <Button size="lg" className="h-14 rounded-2xl text-xl [@media(max-height:500px)]:h-11" disabled={busy || waiting} onClick={onAgain}>
          {waiting ? 'Aguardando jogadores…' : 'Jogar de novo'}
        </Button>
        <Button variant="secondary" className="rounded-xl" onClick={onMenu}>
          Menu
        </Button>
      </div>
    </div>
  );
}

/**
 * Touch screens (portrait or landscape) keep the bottom corners for the stick
 * and the boost button: minimap and buttons go top-left, under the stats.
 * Desktop puts the minimap and buttons bottom-right.
 */
function Hud({ scoreRef, touch, muted, onMute, onLeave }: { scoreRef: RefObject<HTMLElement | null>; touch: boolean; muted: boolean; onMute: () => void; onLeave: () => void }) {
  const lb = useSnakeStore((s) => s.leaderboard);
  const myId = useSnakeStore((s) => s.myId);
  const radius = useSnakeStore((s) => s.radius);
  const feed = useSnakeStore((s) => s.feed);
  // Touch: below the minimap in portrait; in landscape at the top, between the stats and the ranking (never over the snake).
  const feedPlace = touch ? 'top-[calc(12.75rem+env(safe-area-inset-top))] text-xs landscape:top-[calc(0.6rem+env(safe-area-inset-top))]' : 'top-[calc(0.6rem+env(safe-area-inset-top))] text-sm';
  const mapRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = mapRef.current;
    if (lb && cv?.getContext('2d')) drawMinimap(cv, radius, lb.dots, lb.me ? [lb.me.x, lb.me.y] : null);
  }, [lb, radius]);

  return (
    <div className="pointer-events-none absolute inset-0 z-10 text-white">
      <div className="absolute top-[calc(0.6rem+env(safe-area-inset-top))] left-[calc(0.75rem+env(safe-area-inset-left))] flex gap-1.5">
        {[
          ['Tamanho', <b key="s" ref={scoreRef} className="text-amber-300" />],
          ['Abates', <b key="k">{lb?.me?.kills ?? 0}</b>],
          ['Posição', <b key="r">{lb?.rank ? `${lb.rank}/${lb.total}` : '-'}</b>],
        ].map(([label, value]) => (
          <div key={label as string} className="flex flex-col rounded-xl bg-black/45 px-2.5 py-1 text-lg leading-tight sm:text-xl">
            <span className="text-[9px] font-extrabold tracking-wider text-slate-300 uppercase">{label}</span>
            {value}
          </div>
        ))}
      </div>
      {lb && (
        <ol
          aria-label="Ranking"
          className="absolute top-[calc(0.6rem+env(safe-area-inset-top))] right-[calc(0.75rem+env(safe-area-inset-right))] w-36 rounded-xl bg-black/45 px-2.5 py-1.5 text-[11px] font-bold sm:w-48 sm:text-[13px]"
        >
          <li className="mb-0.5 text-xs tracking-widest text-amber-300">RANKING</li>
          {lb.top.map((r, i) => (
            <li key={r.id} className={cn('flex justify-between gap-2', i >= 5 && 'max-sm:hidden [@media(max-height:500px)]:hidden', r.id === myId && 'text-green-400')}>
              <span className="truncate">
                {i + 1}. {r.name}
              </span>
              <span>{r.score}</span>
            </li>
          ))}
          {lb.rank > 10 && lb.me && (
            <li className="mt-0.5 flex justify-between border-t border-white/15 pt-0.5 text-green-400">
              <span>{lb.rank}. Você</span>
              <span>{lb.me.score}</span>
            </li>
          )}
        </ol>
      )}
      <canvas
        ref={mapRef}
        width={160}
        height={160}
        aria-hidden
        className={cn(
          'absolute opacity-90',
          touch
            ? 'top-[calc(3.9rem+env(safe-area-inset-top))] left-[calc(0.75rem+env(safe-area-inset-left))] size-22'
            : 'right-[calc(0.75rem+env(safe-area-inset-right))] bottom-[calc(0.75rem+env(safe-area-inset-bottom))] size-36',
        )}
      />
      <div
        className={cn(
          'pointer-events-auto absolute flex gap-2',
          touch
            ? 'top-[calc(9.9rem+env(safe-area-inset-top))] left-[calc(0.75rem+env(safe-area-inset-left))]'
            : 'right-[calc(10.5rem+env(safe-area-inset-right))] bottom-[calc(0.75rem+env(safe-area-inset-bottom))]',
        )}
      >
        <Button variant="secondary" size="icon" className="size-10 rounded-full bg-black/45" aria-label={muted ? 'Ligar som' : 'Desligar som'} onClick={onMute}>
          {muted ? <VolumeX aria-hidden /> : <Volume2 aria-hidden />}
        </Button>
        <Button variant="secondary" size="icon" className="size-10 rounded-full bg-black/45" aria-label="Sair da sala" onClick={onLeave}>
          <X aria-hidden />
        </Button>
      </div>
      <ul aria-live="polite" className={cn('absolute left-1/2 flex -translate-x-1/2 flex-col items-center gap-1 font-extrabold', feedPlace)}>
        {feed.map((f) => (
          <li key={f.key} className="rounded-lg bg-black/35 px-2.5 py-0.5 whitespace-nowrap opacity-90">
            <span className="text-green-400">{f.killer}</span> eliminou <span className="text-rose-400">{f.victim}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const EXIT_TITLE: Record<SnakeExit['reason'], string> = {
  not_found: 'Sala não encontrada',
  full: 'Sala cheia',
  error: 'Não deu para entrar',
  left: 'Você saiu',
};

function ExitScreen({ exit }: { exit: SnakeExit }) {
  return (
    <main role="alert" className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <span aria-hidden className="text-6xl">
        🐍
      </span>
      <h1 className="font-display text-marquee text-3xl font-bold">{EXIT_TITLE[exit.reason]}</h1>
      <p className="text-violet-100">{exit.message}</p>
      <Button asChild size="lg" className="h-12 rounded-xl">
        <Link href="/snake">
          <ChevronLeft aria-hidden /> Voltar ao lobby do Snake.io
        </Link>
      </Button>
    </main>
  );
}

/** One Snake.io room: joins it and shows the live arena with the menu, the game and the death summary. */
export function SnakeRoomScreen({ code }: { code: string }) {
  const router = useRouter();
  const [view] = useState(() => new SnakeView());
  const [input] = useState(() => new SnakeInput());
  const actions: SnakeActions = useSnakeRoom(code, view);
  const connection = useSnakeStore((s) => s.connection);
  const phase = useSnakeStore((s) => s.phase);
  const death = useSnakeStore((s) => s.death);
  const exit = useSnakeStore((s) => s.exit);
  const room = useSnakeStore((s) => s.room);
  const arenaR = useSnakeStore((s) => s.radius);
  const [skin, setSkinState] = useState(() => Math.min(SNAKE_SKINS.length - 1, Math.max(0, readNumber(SKIN_KEY, 0))));
  const [busy, setBusy] = useState(false);
  const [playError, setPlayError] = useState<string | null>(null);
  /** The death summary on screen; it only counts while it is still the current death. */
  const [shownDeath, setShownDeath] = useState<{ death: SnakeDeath; bestBefore: number } | null>(null);
  const [muted, setMuted] = useState(isMuted);
  const [touch, setTouch] = useState(() => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scoreRef = useRef<HTMLElement>(null);
  const phaseRef = useRef(phase);
  const arenaRef = useRef(arenaR);

  useEffect(() => {
    phaseRef.current = phase;
    arenaRef.current = arenaR;
  }, [phase, arenaR]);

  useEffect(() => {
    if (exit?.reason === 'left') router.replace('/snake');
  }, [exit, router]);

  const setSkin = (s: number) => {
    setSkinState(s);
    writeNumber(SKIN_KEY, s);
  };

  // Touch controls on phones/tablets (also turned on by the first touch).
  useEffect(() => {
    const onPointer = (e: PointerEvent) => {
      if (e.pointerType === 'touch') setTouch(true);
    };
    window.addEventListener('pointerdown', onPointer, { passive: true });
    return () => window.removeEventListener('pointerdown', onPointer);
  }, []);

  // Death: sound and record now, the summary a moment later so the crash is visible.
  useEffect(() => {
    if (phase !== 'dead' || !death) return;
    sfx('die');
    navigator.vibrate?.(120);
    const bestBefore = readNumber(BEST_KEY, 0);
    if (death.score > bestBefore) writeNumber(BEST_KEY, death.score);
    const timer = setTimeout(() => setShownDeath({ death, bestBefore }), DEATH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [phase, death]);

  // Canvas loop: interpolate, steer, draw.
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv?.getContext('2d')) return;
    const renderer = new SnakeRenderer(cv);
    // Weak phones start light; the governor lowers or raises the quality from real frame times.
    const governor = new QualityGovernor(initialQuality());
    let quality = qualityFor(governor.level);
    renderer.setQuality(quality);
    const fit = () => renderer.resize(window.innerWidth, window.innerHeight);
    fit();
    window.addEventListener('resize', fit);
    const detach = input.attach(window, cv);
    let raf = 0;
    let zoom = SPECTATE_ZOOM;
    let cam: [number, number] = [0, 0];
    let last = performance.now();
    let sentView: [number, number] = [0, 0];
    const sent = { a: Number.NaN, b: false, t: 0 };
    let lastMass = 0;

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      // Low quality draws ~30 times a second: half the work, still smooth thanks to interpolation.
      if (quality.frameMs && now - last < quality.frameMs - 2) return;
      const dtMs = now - last;
      const dt = Math.min(0.1, dtMs / 1000);
      last = now;
      const workStart = performance.now();
      const playing = phaseRef.current === 'playing';
      const scene = view.scene(now, input.angle);
      const me = playing ? scene?.me : undefined;

      zoom += ((me ? snakeViewScaleFor(me.radius) : SPECTATE_ZOOM) - zoom) * Math.min(1, dt * 2);
      const scale = (Math.max(renderer.w, renderer.h) / BASE_VIEW) * zoom;
      const vw = renderer.w / scale;
      const vh = renderer.h / scale;
      if (Math.abs(vw - sentView[0]) > sentView[0] * 0.05 || Math.abs(vh - sentView[1]) > sentView[1] * 0.05) {
        sentView = [vw, vh];
        actions.viewSize(vw, vh);
      }
      if (scene) {
        const head = me?.pts.at(-1);
        if (head) cam = [head[1], head[2]];
        else {
          const far = Math.hypot(scene.cam[0] - cam[0], scene.cam[1] - cam[1]) > 2000;
          const k = far ? 1 : Math.min(1, dt * 4);
          cam = [cam[0] + (scene.cam[0] - cam[0]) * k, cam[1] + (scene.cam[1] - cam[1]) * k];
        }
      }

      if (playing) {
        input.update([renderer.w / 2, renderer.h / 2], pads());
        const turned = Math.abs(Math.atan2(Math.sin(input.angle - sent.a), Math.cos(input.angle - sent.a))) > 0.02;
        if ((Number.isNaN(sent.a) || turned || input.boost !== sent.b || now - sent.t > INPUT_KEEPALIVE_MS) && now - sent.t > INPUT_MIN_MS) {
          actions.input(input.angle, input.boost);
          sent.a = input.angle;
          sent.b = input.boost;
          sent.t = now;
        }
        if (view.myMass > lastMass && lastMass > 0) sfx('eat');
        if (scoreRef.current) scoreRef.current.textContent = String(view.myMass);
      }
      lastMass = view.myMass;

      renderer.draw({
        cam,
        scale,
        arenaR: arenaRef.current,
        time: now,
        snakes: scene?.snakes ?? [],
        foods: scene?.foods ?? [],
        ghosts: scene?.ghosts ?? [],
        bits: scene?.bits ?? [],
      });
      if (!document.hidden && governor.sample(dtMs, performance.now() - workStart)) {
        quality = qualityFor(governor.level);
        renderer.setQuality(quality);
      }
    };
    raf = requestAnimationFrame(loop);
    const onHide = () => document.hidden && input.reset();
    document.addEventListener('visibilitychange', onHide);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', fit);
      document.removeEventListener('visibilitychange', onHide);
      detach();
    };
  }, [view, input, actions]);

  async function play() {
    unlockAudio();
    setBusy(true);
    setPlayError(null);
    if (touch && !document.fullscreenElement) void document.documentElement.requestFullscreen?.({ navigationUI: 'hide' }).catch(() => undefined);
    const error = await actions.play(skin);
    setBusy(false);
    if (error) setPlayError(error);
    else {
      input.reset();
      sfx('start');
    }
  }

  if (exit && exit.reason !== 'left') return <ExitScreen exit={exit} />;

  return (
    <div className="fixed inset-0 z-50 touch-none overflow-hidden bg-[#0b1020] select-none">
      <canvas ref={canvasRef} className="absolute inset-0 block size-full" aria-label="Arena do Snake.io" />
      <ConnectionBanner status={connection} />
      {phase === 'playing' && (
        <>
          <Hud scoreRef={scoreRef} touch={touch} muted={muted} onMute={() => setMuted(toggleMute())} onLeave={() => void actions.leave()} />
          {touch && <TouchControls input={input} />}
        </>
      )}
      {!room && (
        <div role="status" aria-busy="true" className="absolute inset-0 z-20 grid place-items-center text-white">
          {connection === 'reconnecting' ? 'Reconectando à sala…' : 'Entrando na sala…'}
        </div>
      )}
      {phase === 'menu' && room && <Menu skin={skin} setSkin={setSkin} onPlay={() => void play()} busy={busy || connection !== 'online'} error={playError} room={room} actions={actions} />}
      {phase === 'dead' && death && shownDeath?.death === death && (
        <DeathCard
          death={death}
          bestBefore={shownDeath.bestBefore}
          busy={busy}
          waiting={!room || onlineOf(room) < SNAKE_MIN_PLAYERS}
          onAgain={() => void play()}
          onMenu={() => useSnakeStore.getState().toMenu()}
        />
      )}
    </div>
  );
}

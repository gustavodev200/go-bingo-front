'use client';

import { ChevronLeft, ChevronRight, Loader2, Volume2, VolumeX, X, Zap } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import { SNAKE_SKINS, snakeViewScaleFor } from '@/contracts';
import { Button } from '@/components/ui/button';
import { ConnectionBanner } from '@/features/game/connection-banner';
import { useProfile } from '@/features/profile/profile-context';
import { cn } from '@/lib/utils';
import { useSnakeArena, type SnakeActions } from './connection';
import { SnakeInput, type PadLike } from './input';
import { isMuted, sfx, toggleMute, unlockAudio } from './media/audio';
import { drawMinimap, drawSkinPreview, SnakeRenderer } from './media/renderer';
import { useSnakeStore, type SnakeDeath } from './store';
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

  const down = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (origin) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const box = e.currentTarget.getBoundingClientRect();
    setOrigin({
      x: e.clientX - box.left,
      y: e.clientY - box.top,
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
                  left: 'calc(5.5rem + env(safe-area-inset-left))',
                  bottom: 'calc(1rem + env(safe-area-inset-bottom))',
                  top: 'auto',
                  transform: 'translate(-50%, 0)',
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
            'absolute right-[calc(1.5rem+env(safe-area-inset-right))] bottom-[calc(2rem+env(safe-area-inset-bottom))] grid size-24 place-items-center rounded-full bg-[radial-gradient(circle_at_35%_30%,#fff4b8,#ffd23f_55%,#e09b00)] text-amber-950 shadow-[0_6px_0_#9a6a00] transition',
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
  return (
    <div className="flex items-center justify-center gap-2">
      <Button type="button" variant="secondary" size="icon" className="size-11 rounded-full" aria-label="Skin anterior" onClick={() => onChange((skin + n - 1) % n)}>
        <ChevronLeft aria-hidden />
      </Button>
      <canvas ref={ref} width={260} height={80} aria-label={`Skin ${skin + 1} de ${n}`} role="img" className="h-17 w-55 rounded-2xl bg-black/30" />
      <Button type="button" variant="secondary" size="icon" className="size-11 rounded-full" aria-label="Próxima skin" onClick={() => onChange((skin + 1) % n)}>
        <ChevronRight aria-hidden />
      </Button>
    </div>
  );
}

function Menu({ skin, setSkin, onPlay, busy, error, total }: { skin: number; setSkin: (s: number) => void; onPlay: () => void; busy: boolean; error: string | null; total: number | null }) {
  const { profile } = useProfile();
  const best = readNumber(BEST_KEY, 0);
  return (
    <div className="absolute inset-0 z-20 grid place-items-center overflow-y-auto bg-[radial-gradient(ellipse_at_center,rgb(13_18_36/0.35),rgb(13_18_36/0.85))] p-4">
      <div className="glass flex w-full max-w-sm flex-col gap-4 p-5 text-center">
        <h1 className="font-display text-5xl font-bold tracking-wide">
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
        <Button size="lg" className="h-14 rounded-2xl text-xl" disabled={busy} onClick={onPlay}>
          {busy ? <Loader2 aria-hidden className="animate-spin" /> : null}
          {busy ? 'Entrando…' : 'Jogar'}
        </Button>
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
        <p className="text-muted-foreground text-xs">
          {total !== null ? `🐍 ${total} cobras na arena agora` : 'Conectando à arena…'}
          {best > 0 && ` · 🏆 recorde ${best}`}
        </p>
        <ul className="text-muted-foreground flex flex-col gap-1 text-left text-xs leading-relaxed">
          <li>
            <b className="text-white">Computador:</b> a cobra segue o mouse; segure o clique ou Espaço para o impulso. WASD/setas e controle também.
          </li>
          <li>
            <b className="text-white">Celular:</b> analógico à esquerda, ⚡ impulso à direita.
          </li>
          <li>Coma os pontos, faça os outros baterem no seu corpo e fuja da borda vermelha. O impulso gasta tamanho.</li>
        </ul>
        <Link href="/" className="text-sm text-violet-200 hover:text-white">
          ← Voltar aos jogos
        </Link>
      </div>
    </div>
  );
}

function DeathCard({ death, bestBefore, onAgain, onMenu, busy }: { death: SnakeDeath; bestBefore: number; onAgain: () => void; onMenu: () => void; busy: boolean }) {
  const record = death.score > bestBefore;
  const time = death.secs >= 60 ? `${Math.floor(death.secs / 60)}m ${death.secs % 60}s` : `${death.secs}s`;
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="snake-death-title" className="absolute inset-0 z-20 grid place-items-center bg-black/55 p-4">
      <div className="glass flex w-full max-w-sm flex-col gap-3 p-5 text-center">
        <h2 id="snake-death-title" className="font-display text-3xl font-bold text-rose-400">
          {death.killer ? `Eliminado por ${death.killer}!` : 'Você bateu na borda!'}
        </h2>
        <dl className="grid grid-cols-2 gap-2">
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
        <Button size="lg" className="h-14 rounded-2xl text-xl" disabled={busy} onClick={onAgain}>
          Jogar de novo
        </Button>
        <Button variant="secondary" className="rounded-xl" onClick={onMenu}>
          Menu
        </Button>
      </div>
    </div>
  );
}

function Hud({ scoreRef }: { scoreRef: RefObject<HTMLElement | null> }) {
  const lb = useSnakeStore((s) => s.leaderboard);
  const myId = useSnakeStore((s) => s.myId);
  const radius = useSnakeStore((s) => s.radius);
  const feed = useSnakeStore((s) => s.feed);
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
            <li key={r.id} className={cn('flex justify-between gap-2', i >= 5 && 'max-sm:hidden', r.id === myId && 'text-green-400')}>
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
        className="absolute top-[calc(4.2rem+env(safe-area-inset-top))] left-[calc(0.75rem+env(safe-area-inset-left))] size-22 opacity-90 md:top-auto md:right-[calc(0.75rem+env(safe-area-inset-right))] md:bottom-[calc(0.75rem+env(safe-area-inset-bottom))] md:left-auto md:size-36"
      />
      <ul
        aria-live="polite"
        className="absolute top-[calc(6.5rem+env(safe-area-inset-top))] left-1/2 flex -translate-x-1/2 flex-col items-center gap-1 text-xs font-extrabold sm:top-[calc(0.6rem+env(safe-area-inset-top))] sm:text-sm"
      >
        {feed.map((f) => (
          <li key={f.key} className="rounded-lg bg-black/45 px-3 py-0.5 whitespace-nowrap">
            <span className="text-green-400">{f.killer}</span> eliminou <span className="text-rose-400">{f.victim}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Snake.io: one open arena — menu over the live arena, the game, and the death summary. */
export function SnakeScreen() {
  const [view] = useState(() => new SnakeView());
  const [input] = useState(() => new SnakeInput());
  const actions: SnakeActions = useSnakeArena(view);
  const connection = useSnakeStore((s) => s.connection);
  const phase = useSnakeStore((s) => s.phase);
  const death = useSnakeStore((s) => s.death);
  const fatal = useSnakeStore((s) => s.error);
  const total = useSnakeStore((s) => s.leaderboard?.total ?? null);
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
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
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

  if (fatal)
    return (
      <main role="alert" className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
        <span aria-hidden className="text-6xl">
          🐍
        </span>
        <h1 className="font-display text-marquee text-3xl font-bold">Não deu para entrar</h1>
        <p className="text-violet-100">{fatal}</p>
        <Button asChild size="lg" className="h-12 rounded-xl">
          <Link href="/">
            <ChevronLeft aria-hidden /> Voltar aos jogos
          </Link>
        </Button>
      </main>
    );

  return (
    <div className="fixed inset-0 z-50 touch-none overflow-hidden bg-[#0b1020] select-none">
      <canvas ref={canvasRef} className="absolute inset-0 block size-full" aria-label="Arena do Snake.io" />
      <ConnectionBanner status={connection} />
      {phase === 'playing' && (
        <>
          <Hud scoreRef={scoreRef} />
          {touch && <TouchControls input={input} />}
          <div className="absolute right-[calc(0.75rem+env(safe-area-inset-right))] bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-20 flex gap-2 max-md:top-[calc(13rem+env(safe-area-inset-top))] max-md:bottom-auto max-md:flex-col md:right-44">
            <Button variant="secondary" size="icon" className="size-10 rounded-full bg-black/45" aria-label={muted ? 'Ligar som' : 'Desligar som'} onClick={() => setMuted(toggleMute())}>
              {muted ? <VolumeX aria-hidden /> : <Volume2 aria-hidden />}
            </Button>
            <Button asChild variant="secondary" size="icon" className="size-10 rounded-full bg-black/45">
              {/* Leaving the page drops the socket, which ends the snake on the server. */}
              <Link href="/" aria-label="Sair do jogo">
                <X aria-hidden />
              </Link>
            </Button>
          </div>
        </>
      )}
      {phase === 'menu' && <Menu skin={skin} setSkin={setSkin} onPlay={() => void play()} busy={busy || connection !== 'online'} error={playError} total={total} />}
      {phase === 'dead' && death && shownDeath?.death === death && <DeathCard death={death} bestBefore={shownDeath.bestBefore} busy={busy} onAgain={() => void play()} onMenu={() => useSnakeStore.getState().toMenu()} />}
    </div>
  );
}

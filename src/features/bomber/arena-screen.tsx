'use client';

import { DoorOpen, RotateCcw, Volume2, VolumeX, X } from 'lucide-react';
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { toast } from 'sonner';
import { BOMBER_COLORS, BOMBER_CURSE_LABEL, BOMBER_SUDDEN_DEATH_AT, BOMBER_TICK_MS, type BomberCurse, type BomberFrame, type BomberRoomState } from '@/contracts';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ArenaBus } from './bus';
import type { BomberActions } from './connection';
import { BomberInput, joystickDir } from './input';
import { isMuted, setMusicFast, sfx, startMusic, stopMusic, toggleMute, unlockAudio } from './media/audio';
import { ArenaRenderer } from './media/renderer';
import { reactToAnnouncement, reactToFrame, type Banner, type Reaction } from './reactions';
import { Portrait } from './room-lobby';
import { buildView } from './view';

interface Hud {
  timeLeft: number;
  alive: Record<number, boolean>;
  mine: { bombs: number; fire: number; speedUps: number; flags: number; curse: BomberCurse | 0; alive: boolean } | null;
}

function hudFrom(frame: BomberFrame, mySeat: number): Hud {
  const me = frame.players.find((p) => p[0] === mySeat);
  return {
    timeLeft: frame.timeLeft,
    alive: Object.fromEntries(frame.players.map((p) => [p[0], p[5] === 1])),
    mine: me ? { bombs: me[10], fire: me[11], speedUps: me[12], flags: me[13], curse: me[7], alive: me[5] === 1 } : null,
  };
}

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.max(0, s) % 60).padStart(2, '0')}`;

const BANNER_TONE: Record<Banner['tone'], string> = {
  info: 'text-amber-300',
  go: 'text-lime-300',
  hurry: 'text-red-500 motion-safe:animate-pulse',
  win: 'text-amber-300',
  lose: 'text-slate-200',
};

/** On-screen controls for touch screens: floating joystick on the left, bomb and B on the right. */
function TouchControls({ input }: { input: BomberInput }) {
  const [origin, setOrigin] = useState<{ x: number; y: number; id: number } | null>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const R = 46;

  const down = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (origin) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const box = e.currentTarget.getBoundingClientRect();
    setOrigin({ x: e.clientX - box.left, y: e.clientY - box.top, id: e.pointerId });
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
    const dir = joystickDir(dx, dy);
    if (dir && dir !== input.touchDir) navigator.vibrate?.(6);
    input.setTouchDir(dir);
  };
  const up = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!origin || e.pointerId !== origin.id) return;
    setOrigin(null);
    input.setTouchDir(0);
  };
  const press = (fn: () => void) => (e: ReactPointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    fn();
    navigator.vibrate?.(12);
  };

  return (
    <div className="pointer-events-none absolute inset-0 flex justify-between portrait:static portrait:h-[min(40vh,280px)] portrait:shrink-0">
      <div role="presentation" aria-label="Joystick" className="pointer-events-auto relative h-full w-[34%] touch-none portrait:w-1/2" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
        <div
          className="absolute size-28 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white/30 bg-white/10"
          style={origin ? { left: origin.x, top: origin.y } : { left: '50%', top: '55%' }}
        >
          <div className="absolute top-1/2 left-1/2 size-13 rounded-full border-[3px] border-black bg-[radial-gradient(circle_at_35%_35%,#fff,#c8c8d8)] shadow-[0_4px_0_rgb(0_0_0/0.4)]" style={{ transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))` }} />
        </div>
        <span className="absolute bottom-3 left-1/2 -translate-x-1/2 text-xs font-bold whitespace-nowrap text-white/35">arraste para mover</span>
      </div>
      <div className="pointer-events-auto relative h-full w-[30%] touch-none portrait:w-1/2">
        <button type="button" aria-label="Ação (luva ou remoto)" onPointerDown={press(() => input.pressAction())} className="font-display absolute right-[7.5rem] bottom-[14%] size-16 rounded-full border-4 border-black bg-[radial-gradient(circle_at_35%_30%,#7ab8ff,#2a6ad8)] text-2xl text-white shadow-[0_6px_0_#000] active:translate-y-1 active:shadow-[0_2px_0_#000]">
          B
        </button>
        <button type="button" aria-label="Soltar bomba" onPointerDown={press(() => input.pressBomb())} className="absolute right-4 bottom-[34%] size-24 rounded-full border-4 border-black bg-[radial-gradient(circle_at_35%_30%,#ff7a5c,#e8402c)] text-4xl shadow-[0_6px_0_#000] active:translate-y-1 active:shadow-[0_2px_0_#000]">
          💣
        </button>
      </div>
    </div>
  );
}

function Results({ state, mySeat, actions }: { state: BomberRoomState; mySeat: number; actions: BomberActions }) {
  const result = state.result!;
  const champ = state.seats[result.winner];
  const standings = state.seats.flatMap((s, seat) => (s ? [{ ...s, wins: result.wins[seat] }] : [])).sort((a, b) => b.wins - a.wins);
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="bomber-result-title" className="absolute inset-0 z-30 flex items-center justify-center bg-black/70 p-4">
      <div className="glass flex w-full max-w-md flex-col items-center gap-3 p-5 text-center">
        <span aria-hidden className="text-5xl">
          👑
        </span>
        <h2 id="bomber-result-title" className="font-display text-marquee text-3xl font-bold">
          {result.winner === mySeat ? 'Você é o campeão!' : `${champ?.nickname ?? 'Alguém'} é o campeão!`}
        </h2>
        <ol className="flex w-full flex-col gap-1 text-left">
          {standings.map((p, i) => (
            <li key={p.userId} className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-1.5 font-semibold">
              <span className="w-6 text-amber-200">{i + 1}º</span>
              <span aria-hidden className="size-3.5 rounded-full border-2 border-white" style={{ background: BOMBER_COLORS[p.color]?.helmet }} />
              <span className="flex-1 truncate">{p.nickname}</span>
              <span aria-label={`${p.wins} vitórias`}>{'🏆'.repeat(p.wins) || '—'}</span>
            </li>
          ))}
        </ol>
        <div className="flex w-full gap-2">
          <Button variant="secondary" className="h-12 flex-1 gap-2 rounded-xl" onClick={() => void actions.leave()}>
            <DoorOpen aria-hidden /> Sair
          </Button>
          <Button className="h-12 flex-1 gap-2 rounded-xl" onClick={() => void actions.rematch()}>
            <RotateCcw aria-hidden /> Jogar de novo
          </Button>
        </div>
      </div>
    </div>
  );
}

/** The battle: canvas arena, scoreboard, controls and effects. */
export function ArenaScreen({ state, mySeat, actions, bus }: { state: BomberRoomState; mySeat: number; actions: BomberActions; bus: ArenaBus }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<ArenaRenderer | null>(null);
  const [input] = useState(() => new BomberInput());
  const introUntil = useRef(0);
  const stateRef = useRef(state);
  const [hud, setHud] = useState<Hud | null>(() => (bus.latest ? hudFrom(bus.latest, mySeat) : null));
  const [banner, setBanner] = useState<Banner | null>(null);
  const [muted, setMuted] = useState(isMuted);
  const [touch, setTouch] = useState(() => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    bus.setSeat(mySeat);
  }, [bus, mySeat]);

  // Touch controls on phones/tablets (also turned on by the first touch).
  useEffect(() => {
    const onTouch = (e: PointerEvent) => {
      if (e.pointerType === 'touch') setTouch(true);
    };
    window.addEventListener('pointerdown', onTouch, { passive: true });
    return () => window.removeEventListener('pointerdown', onTouch);
  }, []);

  // Keyboard; audio unlocks on the first gesture.
  useEffect(() => {
    const detach = input.attach(window);
    const unlock = () => {
      unlockAudio();
      startMusic();
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    const onHide = () => document.hidden && input.reset();
    document.addEventListener('visibilitychange', onHide);
    return () => {
      detach();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      document.removeEventListener('visibilitychange', onHide);
      stopMusic();
    };
  }, [input]);

  // Canvas sized to the stage.
  useEffect(() => {
    const cv = canvasRef.current;
    const stage = stageRef.current;
    if (!cv || !stage || !cv.getContext('2d')) return;
    const renderer = new ArenaRenderer(cv);
    rendererRef.current = renderer;
    const fit = () => renderer.resize(stage.clientWidth - 8, stage.clientHeight - 8);
    fit();
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(fit) : null;
    ro?.observe(stage);
    return () => {
      ro?.disconnect();
      rendererRef.current = null;
    };
  }, [touch]);

  // Frames and announcements → sounds, banners, toasts.
  useEffect(() => {
    let countdownBanner = -1;
    const apply = (r: Reaction) => {
      r.sfx.forEach(sfx);
      if (r.shake && rendererRef.current) rendererRef.current.shake = Math.min(3, rendererRef.current.shake + r.shake);
      if (r.toast) toast(r.toast, { duration: 1200 });
      if (r.banner) setBanner(r.banner);
      if (r.vibrate) navigator.vibrate?.(r.vibrate);
      if (r.musicFast !== undefined) setMusicFast(r.musicFast);
    };
    return bus.subscribe((e) => {
      if (e.type === 'frame') {
        const f = e.frame;
        if (f.phase === 'countdown' && f.phaseLeft < 1.3 && countdownBanner !== f.roundNumber) {
          countdownBanner = f.roundNumber;
          sfx('beep');
          setBanner({ text: 'PRONTO?', tone: 'info', ms: 0 });
        }
        apply(reactToFrame(f, mySeat));
        return;
      }
      if (e.msg.event === 'bomber:round_started') {
        introUntil.current = performance.now() + 3500;
        rendererRef.current?.resetDeaths();
        input.reset();
      }
      apply(reactToAnnouncement(e.msg, stateRef.current, mySeat));
    });
  }, [bus, mySeat, input]);

  useEffect(() => {
    if (!banner?.ms) return;
    const id = setTimeout(() => setBanner(null), banner.ms);
    return () => clearTimeout(id);
  }, [banner]);

  // Fixed 30 Hz input ticks + one draw per animation frame.
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    let hudAt = 0;
    const colorOf = (seat: number) => stateRef.current.seats[seat]?.color ?? seat;
    const loop = (now: number) => {
      acc += Math.min(250, now - last);
      last = now;
      while (acc >= BOMBER_TICK_MS) {
        acc -= BOMBER_TICK_MS;
        const inp = input.sample();
        const seq = bus.predictor.step(bus.latest, inp.d);
        if (seq !== null) actions.input(seq, inp);
      }
      const view = buildView(bus.frames, now, {
        mySeat,
        colorOf,
        me: { pos: bus.predictor.render(), dir: bus.predictor.dir, moving: bus.predictor.moving },
        introLeft: Math.max(0, (introUntil.current - now) / 1000),
      });
      if (view) rendererRef.current?.draw(view, now);
      if (bus.latest && now - hudAt > 200) {
        hudAt = now;
        setHud(hudFrom(bus.latest, mySeat));
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [bus, actions, mySeat, input]);

  const seats = state.seats.flatMap((s, seat) => (s ? [{ ...s, seat }] : []));
  const mine = hud?.mine;
  return (
    <main className="fixed inset-0 z-10 flex flex-col bg-[#101018] text-white select-none">
      <header className="flex shrink-0 items-center gap-2 border-b-[3px] border-black bg-[#2b2b33] px-2 pt-[calc(0.25rem+env(safe-area-inset-top))] pb-1">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Sair da partida"
          className="size-9 shrink-0 rounded-full border-2 border-white/80"
          onClick={() => {
            if (window.confirm('Sair da partida?')) void actions.leave();
          }}
        >
          <X aria-hidden className="size-4" />
        </Button>
        <ul aria-label="Placar" className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto [scrollbar-width:none]">
          {seats.map((p) => (
            <li key={p.seat} className={cn('flex shrink-0 items-center gap-0.5 rounded-lg border-2 bg-[#1a1a22] py-0.5 pr-1.5 pl-0.5', p.seat === mySeat ? 'border-amber-300' : 'border-white/15', hud?.alive[p.seat] === false && 'opacity-40 grayscale')} aria-label={`${p.nickname}: ${state.wins[p.seat]} vitórias`}>
              <Portrait color={p.color} className="h-7 w-6" />
              <span className="font-display text-sm">🏆{state.wins[p.seat]}</span>
            </li>
          ))}
        </ul>
        <span role="timer" aria-label="Tempo restante" className={cn('font-display rounded-md border-2 border-black bg-white px-2 text-lg text-slate-900 tabular-nums', hud && hud.timeLeft <= BOMBER_SUDDEN_DEATH_AT && 'bg-red-500 text-white')}>
          {clock(hud?.timeLeft ?? 150)}
        </span>
        <Button variant="ghost" size="icon" aria-label={muted ? 'Ligar som' : 'Desligar som'} className="size-9 shrink-0 rounded-full border-2 border-white/80" onClick={() => setMuted(toggleMute())}>
          {muted ? <VolumeX aria-hidden className="size-4" /> : <Volume2 aria-hidden className="size-4" />}
        </Button>
      </header>

      <div className={cn('relative flex min-h-0 flex-1 flex-col', touch && 'portrait:flex-col')}>
        <div ref={stageRef} className="relative flex min-h-0 flex-1 items-center justify-center">
          <canvas ref={canvasRef} aria-label="Arena" role="img" className="rounded [image-rendering:pixelated] shadow-[0_0_0_3px_#000,0_10px_40px_rgb(0_0_0/0.6)]" />
          {banner && (
            <div aria-live="polite" className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center p-4 text-center">
              <p key={banner.text} className={cn('font-display animate-in zoom-in-50 text-5xl font-black [-webkit-text-stroke:2px_#000] drop-shadow-[0_5px_0_#000] sm:text-7xl', BANNER_TONE[banner.tone])}>
                {banner.text}
              </p>
              {banner.sub && <p className="mt-2 text-xl font-bold drop-shadow-[0_2px_0_#000]">{banner.sub}</p>}
            </div>
          )}
          <p className="pointer-events-none absolute bottom-1 left-1/2 flex -translate-x-1/2 flex-wrap justify-center gap-1.5 text-xs font-bold" aria-label="Seus poderes">
            {mine?.alive ? (
              <>
                <span className="rounded-lg bg-black/60 px-1.5">💣{mine.bombs}</span>
                <span className="rounded-lg bg-black/60 px-1.5">🔥{mine.fire}</span>
                <span className="rounded-lg bg-black/60 px-1.5">🛼{mine.speedUps}</span>
                {mine.flags & 1 ? <span className="rounded-lg bg-black/60 px-1.5">🥾</span> : null}
                {mine.flags & 2 ? <span className="rounded-lg bg-black/60 px-1.5">🧤</span> : null}
                {mine.flags & 4 ? <span className="rounded-lg bg-black/60 px-1.5">📡</span> : null}
                {mine.curse ? <span className="rounded-lg bg-purple-800 px-1.5">☠ {BOMBER_CURSE_LABEL[mine.curse]}</span> : null}
              </>
            ) : mine ? (
              <span className="rounded-lg bg-black/60 px-1.5">👻 Assistindo…</span>
            ) : null}
          </p>
        </div>
        {touch && <TouchControls input={input} />}
      </div>

      {state.phase === 'FINISHED' && state.result && <Results state={state} mySeat={mySeat} actions={actions} />}
    </main>
  );
}

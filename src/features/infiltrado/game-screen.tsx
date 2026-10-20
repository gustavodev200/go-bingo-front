'use client';

import { Map as MapIcon, Skull, Megaphone, Volume2, VolumeX, X, Zap, Wind, Hand, ListChecks, ChevronDown, ChevronUp } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { toast } from 'sonner';
import {
  INF_ROOMS,
  INF_SABOTAGE_INFO,
  INF_STATIONS,
  INF_TASK_INFO,
  INF_TICK_MS,
  INF_USE_RANGE,
  INF_VENTS,
  INF_VISION_CREW,
  INF_VISION_DARK,
  INF_VISION_IMPOSTOR,
  INF_FIX_PANELS,
  infDist,
  infRoomAt,
  type InfFrame,
  type InfRoomState,
  type InfSabotage,
} from '@/contracts';
import { cn } from '@/lib/utils';
import { interpolatePlayers, INTERP_MS, type InfBus } from './bus';
import type { InfActions } from './connection';
import { InfInputState, isTyping, joystickVector } from './input';
import { isMuted, sfx, toggleMute, unlockAudio } from './media/audio';
import { InfRenderer, type RenderDiver } from './media/renderer';
import { MeetingOverlay } from './meeting';
import { LightsFix, OxygenFix, ReactorFix, TaskGame } from './minigames';
import { DeathFlash, EjectOverlay, IntroOverlay, MapOverlay, ResultsOverlay } from './overlays';
import { useInfStore } from './store';
import { arrowsFor, isCritical, marksFor, reachFrom, actionLabel, type Reach, type UseTarget } from './view-model';

type Open = { kind: 'task'; station: number } | { kind: 'fix'; panel: number } | { kind: 'reactor'; panel: number };

interface Hud {
  frame: InfFrame;
  reach: Reach;
  pos: { x: number; y: number } | null;
}

/**
 * Everything the HUD shows, as a string: React only re-renders when it changes
 * (positions alone change every frame but are drawn by the canvas).
 */
export function hudKey(frame: InfFrame, reach: Reach, pos: { x: number; y: number } | null, withPos: boolean): string {
  const m = frame.me;
  const sab = frame.sabotage;
  const mt = frame.meeting;
  return [
    frame.phase,
    Math.ceil(frame.phaseLeft),
    m.alive ? 1 : 0,
    m.role,
    m.vent,
    m.meetingsLeft,
    m.holding,
    Math.ceil(m.killCd),
    Math.ceil(m.sabotageCd),
    m.tasks.map((t) => t[1]).join(''),
    m.mates.join(','),
    frame.taskBar,
    sab ? `${sab.kind}${sab.left === null ? '' : Math.ceil(sab.left)}${sab.fixed.join('')}` : '-',
    Math.ceil(frame.buttonCd),
    mt ? `${mt.stage}${Math.ceil(mt.left)}/${mt.voted.join(',')}/${mt.voters.length}/${mt.votes?.length ?? '-'}` : '-',
    frame.eject ? `${frame.eject.seat}` : '-',
    reach.use ? JSON.stringify(reach.use) : '-',
    reach.report ?? '-',
    reach.kill ?? '-',
    pos ? (infRoomAt(pos.x, pos.y)?.id ?? 'hall') : '-',
    withPos && pos ? `${Math.round(pos.x * 2)},${Math.round(pos.y * 2)}` : '',
  ].join('|');
}

const roomName = (pos: { x: number; y: number } | null) => (pos ? (infRoomAt(pos.x, pos.y)?.name ?? 'Corredor') : '');

/** Floating joystick on the left half of the screen (touch devices). */
function Joystick({ input }: { input: InfInputState }) {
  const [origin, setOrigin] = useState<{ x: number; y: number; id: number } | null>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const R = 50;
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
    const [vx, vy] = joystickVector(dx, dy, R);
    input.setTouch(vx, vy);
  };
  const up = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!origin || e.pointerId !== origin.id) return;
    setOrigin(null);
    input.setTouch(0, 0);
  };
  return (
    <div role="presentation" className="absolute bottom-0 left-0 z-10 h-[55%] w-[50%] touch-none" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
      <div
        className="absolute size-28 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white/30 bg-white/10"
        style={origin ? { left: origin.x, top: origin.y } : { left: '50%', top: '72%' }}
      >
        <div
          className="absolute top-1/2 left-1/2 size-12 rounded-full border-[3px] border-black bg-[radial-gradient(circle_at_35%_35%,#fff,#a5d8ec)]"
          style={{ transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))` }}
        />
      </div>
    </div>
  );
}

function ActionButton({
  label,
  onClick,
  disabled,
  tone,
  icon,
  count,
  keyHint,
  big,
}: {
  label: string;
  onClick(): void;
  disabled?: boolean;
  tone: string;
  icon: React.ReactNode;
  count?: number;
  keyHint?: string;
  big?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onPointerDown={(e) => {
        e.preventDefault();
        if (!disabled) {
          navigator.vibrate?.(10);
          onClick();
        }
      }}
      aria-label={label}
      className={cn(
        'relative flex flex-col items-center justify-center rounded-2xl border-[3px] border-black font-black text-white shadow-[0_4px_0_#000] select-none active:translate-y-1 active:shadow-none disabled:opacity-35 disabled:grayscale',
        big ? 'size-20 text-xs sm:size-24' : 'size-16 text-[10px] sm:size-20',
        tone,
      )}
    >
      {icon}
      <span className="mt-0.5 leading-none">{label}</span>
      {count !== undefined && count > 0 && <span className="absolute inset-0 grid place-items-center rounded-2xl bg-black/55 text-3xl tabular-nums">{count}</span>}
      {keyHint && <span className="absolute top-0.5 right-1 hidden text-[10px] text-white/70 [@media(pointer:fine)]:block">{keyHint}</span>}
    </button>
  );
}

/** The match: canvas station, controls, tasks, sabotage alarms and every overlay. */
export function GameScreen({ state, mySeat, actions, bus }: { state: InfRoomState; mySeat: number; actions: InfActions; bus: InfBus }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<InfRenderer | null>(null);
  const [input] = useState(() => new InfInputState());
  const stateRef = useRef(state);
  const [hud, setHud] = useState<Hud | null>(null);
  const [open, setOpen] = useState<Open | null>(null);
  const openRef = useRef<Open | null>(null);
  const [showMap, setShowMap] = useState(false);
  const showMapRef = useRef(false);
  const [death, setDeath] = useState<number | null>(null);
  const [tasksOpen, setTasksOpen] = useState(true);
  const [muted, setMuted] = useState(isMuted);
  const [touch, setTouch] = useState(() => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  useEffect(() => {
    openRef.current = open;
    showMapRef.current = showMap;
    input.setLocked(open !== null);
  }, [open, showMap, input]);

  useEffect(() => {
    const onTouch = (e: PointerEvent) => {
      if (e.pointerType === 'touch') setTouch(true);
    };
    window.addEventListener('pointerdown', onTouch, { passive: true });
    return () => window.removeEventListener('pointerdown', onTouch);
  }, []);

  useEffect(() => {
    const detach = input.attach(window);
    const unlock = () => unlockAudio();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    const onHide = () => document.hidden && input.reset();
    document.addEventListener('visibilitychange', onHide);
    return () => {
      detach();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      document.removeEventListener('visibilitychange', onHide);
    };
  }, [input]);

  // Canvas sized to the stage.
  useEffect(() => {
    const cv = canvasRef.current;
    const stage = stageRef.current;
    if (!cv || !stage || !cv.getContext('2d')) return;
    const renderer = new InfRenderer(cv);
    rendererRef.current = renderer;
    const fit = () => renderer.resize(stage.clientWidth, stage.clientHeight);
    fit();
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(fit) : null;
    ro?.observe(stage);
    return () => {
      ro?.disconnect();
      rendererRef.current = null;
    };
  }, []);

  // Frame events → sounds, flashes and toasts.
  useEffect(() => {
    return bus.subscribe((e) => {
      if (e.type !== 'frame') return;
      const { frame, prev } = e;
      if (prev?.phase !== frame.phase) {
        if (frame.phase === 'intro') sfx('reveal');
        if (frame.phase === 'meeting') {
          sfx(frame.meeting?.body !== null ? 'alarm' : 'meeting');
          setOpen(null);
          setShowMap(false);
          input.reset();
        }
        if (frame.phase === 'eject') sfx('eject');
      }
      for (const ev of frame.events)
        switch (ev.k) {
          case 'killed':
            sfx('killed');
            navigator.vibrate?.([80, 40, 160]);
            setOpen(null);
            setDeath(ev.by);
            setTimeout(() => setDeath(null), 3200);
            break;
          case 'kill':
            sfx('kill');
            break;
          case 'task':
            sfx('task');
            break;
          case 'sabotage':
            sfx(INF_SABOTAGE_INFO[ev.kind].critical ? 'alarm' : 'siren');
            toast.warning(INF_SABOTAGE_INFO[ev.kind].name, { duration: 2500 });
            break;
          case 'fixed':
            sfx('fixed');
            toast.success(`${INF_SABOTAGE_INFO[ev.kind].name.split(' ')[0]}: consertado!`, { duration: 1500 });
            if (openRef.current?.kind !== 'task') setOpen(null);
            break;
          case 'vent':
            sfx('vent');
            break;
        }
      // Repairs running out: a beep each second.
      if (frame.sabotage?.left != null && prev?.sabotage?.left != null && Math.ceil(frame.sabotage.left) !== Math.ceil(prev.sabotage.left)) sfx('siren');
    });
  }, [bus, input]);

  // Ghost talk can arrive any time; meeting chat beeps.
  useEffect(
    () =>
      useInfStore.subscribe((s, p) => {
        if (s.chat.length > p.chat.length) sfx('chat');
      }),
    [],
  );

  // Fixed-rate input ticks + one draw per animation frame + HUD at ~10 Hz.
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    let hudAt = 0;
    let lastKey = '';
    const seatInfo = (seat: number) => stateRef.current.seats[seat];
    const loop = (now: number) => {
      acc += Math.min(250, now - last);
      last = now;
      while (acc >= INF_TICK_MS) {
        acc -= INF_TICK_MS;
        const [x, y] = input.sample();
        const seq = bus.predictor.step(bus.latest, x, y);
        if (seq !== null) actions.input(seq, x, y);
      }
      const frame = bus.latest;
      const renderer = rendererRef.current;
      if (frame && renderer) {
        const pos = bus.predictor.render() ?? { x: frame.me.x, y: frame.me.y };
        const me = frame.me;
        const mine = seatInfo(mySeat);
        const others: RenderDiver[] = [];
        for (const [seat, p] of interpolatePlayers(bus.frames, now - INTERP_MS)) {
          const s = seatInfo(seat);
          others.push({ seat, x: p.x, y: p.y, color: s?.color ?? 0, facing: p.facing, moving: p.moving, ghost: (p.flags & 1) === 1, name: s?.nickname ?? '', mate: (p.flags & 2) === 2 });
        }
        const inWorld = frame.phase === 'play' || frame.phase === 'intro';
        const lights = frame.sabotage?.kind === 'lights';
        renderer.draw({
          cx: pos.x,
          cy: pos.y,
          me:
            inWorld && me.vent < 0
              ? {
                  seat: mySeat,
                  x: pos.x,
                  y: pos.y,
                  color: mine?.color ?? 0,
                  facing: bus.predictor.facing,
                  moving: bus.predictor.moving,
                  ghost: !me.alive,
                  name: mine?.nickname ?? '',
                  mate: me.role === 'impostor',
                }
              : null,
          others: inWorld ? others : [],
          bodies: inWorld ? frame.bodies.map(([seat, x, y]) => ({ seat, x, y, color: seatInfo(seat)?.color ?? 0 })) : [],
          vision: !me.alive ? null : me.role === 'impostor' ? INF_VISION_IMPOSTOR : lights ? INF_VISION_DARK : INF_VISION_CREW,
          marks: marksFor(frame, pos),
          arrows: arrowsFor(frame),
          critical: isCritical(frame) && frame.phase === 'play',
          t: now / 1000,
        });
        if (now - hudAt > 100) {
          hudAt = now;
          const reach = reachFrom(frame, pos);
          const key = hudKey(frame, reach, pos, showMapRef.current);
          if (key !== lastKey) {
            lastKey = key;
            setHud({ frame, reach, pos });
          }
          // Walked away from an open console: close it.
          const o = openRef.current;
          if (o) {
            const spot = o.kind === 'task' ? INF_STATIONS[o.station] : frame.sabotage ? INF_FIX_PANELS[frame.sabotage.kind][o.panel] : null;
            if (!spot || infDist(pos.x, pos.y, spot.x, spot.y) > INF_USE_RANGE + 0.8 || frame.phase !== 'play') setOpen(null);
          }
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [bus, actions, mySeat, input]);

  const frame = hud?.frame ?? bus.latest;
  const reach = hud?.reach ?? { use: null, report: null, kill: null };

  const activate = useCallback(
    async (t: UseTarget | null) => {
      if (!t) return;
      sfx('click');
      switch (t.kind) {
        case 'task':
          if (await actions.act({ t: 'task_open', station: t.station })) setOpen({ kind: 'task', station: t.station });
          return;
        case 'fix':
          return setOpen({ kind: 'fix', panel: t.panel });
        case 'reactor':
          return setOpen({ kind: 'reactor', panel: t.panel });
        case 'button':
          return void actions.act({ t: 'emergency' });
        case 'vent':
          return void actions.act({ t: 'vent_enter' });
      }
    },
    [actions],
  );
  const kill = useCallback(() => reach.kill !== null && void actions.act({ t: 'kill', target: reach.kill }), [actions, reach.kill]);
  const report = useCallback(() => reach.report !== null && void actions.act({ t: 'report', body: reach.report }), [actions, reach.report]);
  const sabotage = (kind: InfSabotage) => {
    setShowMap(false);
    void actions.act({ t: 'sabotage', kind });
  };

  // Keyboard shortcuts: E use, Q kill, R report, M/Tab map, Esc close.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target) || e.repeat) return;
      if (e.code === 'Escape') {
        setOpen(null);
        setShowMap(false);
        return;
      }
      if (frame?.phase !== 'play') return;
      if (e.code === 'KeyE' || e.code === 'Space') {
        e.preventDefault();
        if (frame.me.vent >= 0) void actions.act({ t: 'vent_exit' });
        else void activate(reach.use);
      } else if (e.code === 'KeyQ') kill();
      else if (e.code === 'KeyR') report();
      else if (e.code === 'KeyM' || e.code === 'Tab') {
        e.preventDefault();
        setShowMap((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [frame, reach.use, activate, kill, report, actions]);

  const done = useRef(false);
  useEffect(() => {
    done.current = false;
  }, [open]);
  // Stable while the same console is open, so the mini-games' timers are not restarted by the HUD.
  const finishOpen = useCallback(() => {
    if (done.current || !open || open.kind === 'reactor') return;
    done.current = true;
    void actions.act(open.kind === 'task' ? { t: 'task_done', station: open.station } : { t: 'fix', panel: open.panel }).then(() => setOpen(null));
  }, [open, actions]);

  const me = frame?.me;
  const imp = me?.role === 'impostor';
  const inVent = (me?.vent ?? -1) >= 0;
  const sab = frame?.sabotage ?? null;
  const tasksDone = me?.tasks.filter(([, d]) => d).length ?? 0;
  const playing = frame?.phase === 'play';

  return (
    <main className="fixed inset-0 z-10 flex flex-col overflow-hidden bg-[#020b16] text-white select-none">
      <div ref={stageRef} className="absolute inset-0">
        <canvas ref={canvasRef} role="img" aria-label="Estação Abissal" className="block" />
      </div>

      {/* Top bar. */}
      <header className="relative z-20 flex items-start gap-2 px-2 pt-[calc(0.4rem+env(safe-area-inset-top))]">
        <button
          type="button"
          aria-label="Sair da partida"
          className="grid size-10 shrink-0 place-items-center rounded-full border-2 border-white/70 bg-black/50"
          onClick={() => {
            if (window.confirm('Sair da partida? Quem sai no meio perde a entrada.')) void actions.leave();
          }}
        >
          <X aria-hidden className="size-5" />
        </button>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-center gap-2">
            <div
              className="h-5 flex-1 overflow-hidden rounded-md border-2 border-black bg-slate-800"
              role="progressbar"
              aria-label="Tarefas da tripulação"
              aria-valuenow={Math.round((frame?.taskBar ?? 0) * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div className="h-full bg-linear-to-r from-emerald-500 to-lime-300 transition-[width] duration-500" style={{ width: `${(frame?.taskBar ?? 0) * 100}%` }} />
            </div>
            <span className="hidden text-xs font-bold text-slate-300 sm:inline">TAREFAS</span>
          </div>
          <div className="flex flex-wrap items-start gap-2">
            <section aria-label="Suas tarefas" className="max-w-[min(18rem,60vw)] rounded-xl bg-black/55 px-2 py-1 text-xs backdrop-blur-sm">
              <button type="button" onClick={() => setTasksOpen((v) => !v)} className="flex min-h-7 w-full items-center gap-1 font-bold">
                <ListChecks aria-hidden className="size-4" />
                {imp ? 'Tarefas falsas' : `Tarefas ${tasksDone}/${me?.tasks.length ?? 0}`}
                {tasksOpen ? <ChevronUp aria-hidden className="ml-auto size-4" /> : <ChevronDown aria-hidden className="ml-auto size-4" />}
              </button>
              {tasksOpen && me && (
                <ul className="flex flex-col gap-0.5 pb-1">
                  {imp && <li className="font-bold text-red-400">Elimine a tripulação. Finja fazer:</li>}
                  {me.tasks.map(([st, d]) => {
                    const station = INF_STATIONS[st];
                    const room = INF_ROOMS.find((r) => r.id === station.room)?.name;
                    return (
                      <li key={st} className={cn(d ? 'text-emerald-400 line-through' : 'text-slate-100')}>
                        {room}: {INF_TASK_INFO[station.type].name}
                      </li>
                    );
                  })}
                  {!me.alive && <li className="text-violet-300">👻 Você é um fantasma{imp ? ' (ainda pode sabotar)' : ''}.</li>}
                </ul>
              )}
            </section>
            {sab && playing && (
              <p
                role="alert"
                className={cn(
                  'rounded-xl border-2 border-black px-2 py-1 text-xs font-black',
                  INF_SABOTAGE_INFO[sab.kind].critical ? 'bg-red-600 motion-safe:animate-pulse' : 'bg-amber-500 text-black',
                )}
              >
                ⚠ {INF_SABOTAGE_INFO[sab.kind].name}
                {sab.left !== null && ` · ${Math.ceil(sab.left)}s`}
                {sab.fixed.length > 1 && ` · ${sab.fixed.filter(Boolean).length}/${sab.fixed.length}`}
              </p>
            )}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <div className="flex gap-1">
            <button
              type="button"
              aria-label={muted ? 'Ligar som' : 'Desligar som'}
              className="grid size-10 place-items-center rounded-full border-2 border-white/70 bg-black/50"
              onClick={() => setMuted(toggleMute())}
            >
              {muted ? <VolumeX aria-hidden className="size-5" /> : <Volume2 aria-hidden className="size-5" />}
            </button>
            <button type="button" aria-label="Mapa" className="grid size-10 place-items-center rounded-full border-2 border-white/70 bg-black/50" onClick={() => setShowMap(true)}>
              <MapIcon aria-hidden className="size-5" />
            </button>
          </div>
          <span className="rounded-md bg-black/50 px-2 text-xs font-bold text-slate-200">{roomName(hud?.pos ?? null)}</span>
        </div>
      </header>

      {touch && playing && !open && <Joystick input={input} />}

      {/* Action buttons. */}
      {playing && me && (
        <div className="absolute right-2 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-20 flex flex-col items-end gap-2">
          {inVent ? (
            <div className="flex flex-col items-end gap-2">
              {INF_VENTS[me.vent].links.map((to) => (
                <button
                  key={to}
                  type="button"
                  onClick={() => void actions.act({ t: 'vent_move', to })}
                  className="flex h-11 items-center gap-1 rounded-xl border-2 border-black bg-slate-700 px-3 text-sm font-black shadow-[0_3px_0_#000]"
                >
                  <Wind aria-hidden className="size-4" /> {INF_ROOMS.find((r) => r.id === INF_VENTS[to].room)?.name}
                </button>
              ))}
              <ActionButton label="SAIR" big tone="bg-slate-600" icon={<Wind aria-hidden className="size-7" />} onClick={() => void actions.act({ t: 'vent_exit' })} keyHint="E" />
            </div>
          ) : (
            <>
              {imp && (
                <div className="flex gap-2">
                  <ActionButton
                    label="SABOTAR"
                    tone="bg-red-800"
                    icon={<Zap aria-hidden className="size-6" />}
                    count={Math.ceil(me.sabotageCd)}
                    disabled={!!sab}
                    onClick={() => setShowMap(true)}
                    keyHint="M"
                  />
                  {me.alive && (
                    <ActionButton
                      label="ELIMINAR"
                      tone="bg-red-600"
                      icon={<Skull aria-hidden className="size-6" />}
                      count={Math.ceil(me.killCd)}
                      disabled={reach.kill === null || me.killCd > 0}
                      onClick={kill}
                      keyHint="Q"
                    />
                  )}
                </div>
              )}
              <div className="flex gap-2">
                {me.alive && <ActionButton label="REPORTAR" tone="bg-orange-500" icon={<Megaphone aria-hidden className="size-6" />} disabled={reach.report === null} onClick={report} keyHint="R" />}
                <ActionButton
                  label={actionLabel(reach.use, frame)}
                  big
                  tone={reach.use?.kind === 'button' ? 'bg-rose-600' : 'bg-cyan-600'}
                  icon={<Hand aria-hidden className="size-7" />}
                  count={reach.use?.kind === 'button' ? Math.ceil(frame?.buttonCd ?? 0) : undefined}
                  disabled={!reach.use || (reach.use.kind === 'button' && ((frame?.buttonCd ?? 0) > 0 || me.meetingsLeft <= 0 || isCritical(frame)))}
                  onClick={() => void activate(reach.use)}
                  keyHint="E"
                />
              </div>
            </>
          )}
        </div>
      )}

      {!touch && playing && (
        <p className="pointer-events-none absolute bottom-2 left-2 z-10 rounded-lg bg-black/50 px-2 py-1 text-[11px] text-slate-300">
          WASD/setas: andar · E: usar · R: reportar{imp ? ' · Q: eliminar · M: sabotar' : ' · M: mapa'}
        </p>
      )}

      {/* Console being used. */}
      {open && frame && playing && (
        <div role="dialog" aria-modal="true" aria-label="Painel" className="absolute inset-0 z-30 flex items-center justify-center bg-black/60 p-3">
          <div className="relative w-full max-w-sm">
            <button
              type="button"
              aria-label="Fechar painel"
              onClick={() => {
                if (open.kind === 'reactor' && frame.me.holding === open.panel) void actions.act({ t: 'hold', panel: open.panel, on: false }, true);
                setOpen(null);
              }}
              className="absolute -top-3 -right-3 z-10 grid size-10 place-items-center rounded-full border-2 border-black bg-white text-slate-900"
            >
              <X aria-hidden className="size-5" />
            </button>
            <p className="mb-2 text-center font-display text-lg font-bold">
              {open.kind === 'task' ? INF_TASK_INFO[INF_STATIONS[open.station].type].name : sab ? INF_SABOTAGE_INFO[sab.kind].name : ''}
            </p>
            {open.kind === 'task' && <TaskGame type={INF_STATIONS[open.station].type} onDone={finishOpen} />}
            {open.kind === 'fix' && sab?.kind === 'lights' && <LightsFix onDone={finishOpen} />}
            {open.kind === 'fix' && sab?.kind === 'oxygen' && <OxygenFix onDone={finishOpen} />}
            {open.kind === 'reactor' && sab?.kind === 'reactor' && (
              <ReactorFix holding={frame.me.holding === open.panel} otherHeld={sab.fixed[1 - open.panel] === 1} onHold={(on) => void actions.act({ t: 'hold', panel: open.panel, on }, !on)} />
            )}
          </div>
        </div>
      )}

      {showMap && frame && <MapOverlay frame={frame} pos={hud?.pos ?? null} onClose={() => setShowMap(false)} onSabotage={imp && playing ? sabotage : undefined} />}
      {frame?.phase === 'intro' && <IntroOverlay state={state} mySeat={mySeat} frame={frame} />}
      {frame?.phase === 'meeting' && frame.meeting && <MeetingOverlay state={state} mySeat={mySeat} frame={frame} actions={actions} />}
      {frame?.phase === 'eject' && frame.eject && <EjectOverlay state={state} frame={frame} />}
      {death !== null && <DeathFlash state={state} by={death} />}
      {state.phase === 'FINISHED' && state.result && <ResultsOverlay state={state} mySeat={mySeat} actions={actions} />}
    </main>
  );
}

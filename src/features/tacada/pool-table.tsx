'use client';

import { Crosshair } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { toast } from 'sonner';
import {
  aimPreview,
  canPlaceCue,
  freeSpot,
  tacadaGroupOf,
  TacadaSim,
  TACADA_BALL_R,
  TACADA_HEAD_SPOT,
  TACADA_KITCHEN_X,
  TACADA_POCKETS,
  TACADA_SIM_HZ,
  TACADA_TABLE_H,
  TACADA_TABLE_W,
  type TacadaBallPos,
  type TacadaGameView,
  type TacadaRoomPhase,
  type TacadaRules,
} from '@/contracts';
import { cn } from '@/lib/utils';
import type { TacadaActions, TacadaShootInput } from './connection';
import { onRemoteAim, remoteAim } from './live-aim';
import { playSimEvents, playStrike, unlockPoolSound } from './pool-sound';
import { ballSprites, drawFrame, drawStatic, RAIL, WORLD_H, WORLD_W, type Overlay, type View } from './render';
import { useTacadaStore } from './store';
import styles from './tacada.module.css';

const R = TACADA_BALL_R;
const AIM_SEND_MS = 70;
/** Backing store cap (pixels) so low-end phones never paint a giant canvas. */
const MAX_BACKING_PIXELS = 2_600_000;

type Mode = 'aim' | 'place' | null;

interface Props {
  game: TacadaGameView;
  rules: TacadaRules;
  phase: TacadaRoomPhase;
  mySeat: number;
  actions: Pick<TacadaActions, 'shoot' | 'aim'>;
  sound: boolean;
}

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

/** First legal target for the shooter: aims there when the turn starts. */
function defaultAim(balls: readonly TacadaBallPos[], cue: readonly [number, number], legal: (ball: number) => boolean): { dirX: number; dirY: number } {
  let best: { d: number; x: number; y: number } | null = null;
  for (let i = 1; i < balls.length; i++) {
    const b = balls[i];
    if (!b || !legal(i)) continue;
    const d = (b[0] - cue[0]) ** 2 + (b[1] - cue[1]) ** 2;
    if (!best || d < best.d) best = { d, x: b[0], y: b[1] };
  }
  if (!best) return { dirX: 1, dirY: 0 };
  const dx = best.x - cue[0];
  const dy = best.y - cue[1];
  const l = Math.sqrt(dx * dx + dy * dy) || 1;
  return { dirX: dx / l, dirY: dy / l };
}

/** Pocket closest to the line the 8 would travel. */
function pocketAlong(x: number, y: number, dx: number, dy: number): number | null {
  let best: number | null = null;
  let bestScore = Infinity;
  TACADA_POCKETS.forEach((p, i) => {
    const ox = p.x - x;
    const oy = p.y - y;
    const proj = ox * dx + oy * dy;
    if (proj <= 0) return;
    const perp = Math.abs(ox * dy - oy * dx);
    const score = perp + proj * 0.02;
    if (score < bestScore) {
      bestScore = score;
      best = i;
    }
  });
  return best;
}

/**
 * The table: a canvas redrawn only when something changes (aim, drag, a rolling shot,
 * the opponent's live aim), plus the power bar, the fine-aim wheel and the spin picker.
 * Shots replay the server's deterministic simulation from `shot.start`.
 */
export function PoolTable({ game, rules, phase, mySeat, actions, sound }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const powerTrackRef = useRef<HTMLDivElement>(null);
  const powerFillRef = useRef<HTMLDivElement>(null);
  const shots = useTacadaStore((s) => s.shots);
  const animating = useTacadaStore((s) => s.animating);
  const [spin, setSpin] = useState({ x: 0, y: 0 });
  const [spinOpen, setSpinOpen] = useState(false);
  const [pocket, setPocket] = useState<number | null>(null);
  const [sending, setSending] = useState(false);

  const myTurn = phase === 'PLAYING' && game.turn === mySeat;
  const interactive = myTurn && !animating && !sending;
  const myGroup = game.groups[mySeat];

  // Everything the render loop reads lives in refs: no React render per pointer move.
  const live = useRef({
    game,
    rules,
    interactive,
    myTurn,
    pocket,
    sound,
    spin,
    aim: { dirX: 1, dirY: 0 },
    power: 0,
    cue: null as [number, number] | null,
    manualPocket: false,
    mode: null as Mode,
    lastAimSent: 0,
    aimTimer: undefined as ReturnType<typeof setTimeout> | undefined,
  });
  const view = useRef<{ v: View; base: HTMLCanvasElement; sprites: ReturnType<typeof ballSprites> } | null>(null);
  const sim = useRef<{ sim: TacadaSim; startedAt: number } | null>(null);
  const raf = useRef<number | null>(null);
  const started = useRef(0);
  const startNextRef = useRef<() => boolean>(() => false);
  const frameRef = useRef<() => void>(() => undefined);
  const tick = useCallback(() => frameRef.current(), []);

  const legalFirst = useCallback(
    (ball: number) => {
      if (game.breakShot) return true;
      if (game.onEight) return ball === 8;
      if (!myGroup) return ball !== 8;
      return tacadaGroupOf(ball) === myGroup;
    },
    [game.breakShot, game.onEight, myGroup],
  );
  const legalRef = useRef(legalFirst);

  /** Balls as they should be drawn now (animation, or the state with the cue being placed). */
  const displayBalls = useCallback((): TacadaBallPos[] => {
    if (sim.current) return sim.current.sim.positions();
    const l = live.current;
    const balls = l.game.balls.slice();
    if (l.interactive && l.game.ballInHand && l.cue) balls[0] = l.cue;
    else if (!l.myTurn && phase === 'PLAYING') {
      const ra = remoteAim();
      if (ra && ra.cueX !== undefined && ra.cueY !== undefined && l.game.ballInHand) balls[0] = [ra.cueX, ra.cueY];
    }
    return balls;
  }, [phase]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const vw = view.current;
    if (!canvas || !vw) return;
    const g = canvas.getContext('2d');
    if (!g) return;
    const l = live.current;
    const balls = displayBalls();
    let aim: Overlay['aim'] = null;
    let legal = true;
    if (!sim.current && phase === 'PLAYING') {
      if (l.interactive) aim = { ...l.aim, power: l.power };
      else if (!l.myTurn) {
        const ra = remoteAim();
        if (ra) aim = { dirX: ra.dirX, dirY: ra.dirY, power: ra.power };
      }
    }
    let guide: Overlay['guide'] = null;
    if (aim && balls[0]) {
      const p = aimPreview(balls, aim.dirX, aim.dirY);
      if (p) {
        if (l.interactive && p.ball !== null) legal = legalRef.current(p.ball);
        guide = { ...p, legal };
      }
    }
    const placing = l.interactive && l.game.ballInHand && l.cue ? { valid: canPlaceCue(l.game.balls, l.cue[0], l.cue[1], l.game.breakShot) } : null;
    drawFrame(g, vw.v, vw.base, vw.sprites, balls, {
      aim,
      guide,
      longGuide: l.rules.aimGuide === 'long',
      placing,
      pocket: l.game.onEight && (l.interactive || !l.myTurn) ? l.pocket : null,
      choosingPocket: l.interactive && l.game.onEight,
      t: (performance.now() - started.current) / 1000,
    });
  }, [displayBalls, phase]);

  const frame = useCallback(() => {
    raf.current = null;
    let again = false;
    const current = sim.current;
    if (current) {
      const target = Math.floor(((performance.now() - current.startedAt) / 1000) * TACADA_SIM_HZ);
      let budget = 240;
      while (!current.sim.done && current.sim.steps < target && budget-- > 0) {
        const events = current.sim.step();
        if (events.length && live.current.sound) playSimEvents(events);
      }
      if (current.sim.done) {
        sim.current = null;
        if (!startNextRef.current()) useTacadaStore.getState().setAnimating(false);
      }
      again = true;
    }
    const l = live.current;
    if (l.interactive && l.game.onEight) again = true;
    draw();
    if (again) raf.current = requestAnimationFrame(tick);
  }, [draw, tick]);

  const requestDraw = useCallback(() => {
    if (raf.current === null && typeof requestAnimationFrame !== 'undefined') raf.current = requestAnimationFrame(tick);
  }, [tick]);

  /** Takes the oldest queued shot and starts rolling it. */
  const startNext = useCallback((): boolean => {
    if (sim.current) return true;
    const next = useTacadaStore.getState().shots[0];
    if (!next) return false;
    useTacadaStore.getState().takeShot(next.id);
    sim.current = { sim: new TacadaSim(next.shot.start, next.shot), startedAt: performance.now() };
    if (live.current.sound) playStrike(next.shot.power);
    requestDraw();
    return true;
  }, [requestDraw]);

  useEffect(() => {
    legalRef.current = legalFirst;
    startNextRef.current = startNext;
    frameRef.current = frame;
  }, [legalFirst, startNext, frame]);

  useEffect(() => {
    started.current = performance.now();
  }, []);

  // Keep the refs in sync with the props.
  useEffect(() => {
    const l = live.current;
    l.game = game;
    l.rules = rules;
    l.interactive = interactive;
    l.myTurn = myTurn;
    l.pocket = pocket;
    l.sound = sound;
    l.spin = spin;
    requestDraw();
  }, [game, rules, interactive, myTurn, pocket, sound, spin, requestDraw]);

  // A new turn: spin and the called pocket start over (reset while rendering, not in an effect).
  const turnKey = `${game.shots}:${game.turn}:${game.ballInHand}`;
  const [seenTurn, setSeenTurn] = useState(turnKey);
  if (seenTurn !== turnKey) {
    setSeenTurn(turnKey);
    setPocket(null);
    setSpin({ x: 0, y: 0 });
  }

  // A new turn for me: place the cue ball (ball in hand) and aim at a legal ball.
  useEffect(() => {
    const l = live.current;
    l.manualPocket = false;
    l.power = 0;
    if (powerFillRef.current) powerFillRef.current.style.transform = 'scaleY(0)';
    if (game.turn !== mySeat) return;
    let cue: [number, number];
    if (game.ballInHand) {
      const start = game.balls[0];
      cue = start && canPlaceCue(game.balls, start[0], start[1], game.breakShot) ? [start[0], start[1]] : freeSpot(game.balls, TACADA_HEAD_SPOT);
      l.cue = cue;
    } else {
      l.cue = null;
      const b = game.balls[0];
      cue = b ? [b[0], b[1]] : [TACADA_HEAD_SPOT.x, TACADA_HEAD_SPOT.y];
    }
    l.aim = game.breakShot ? { dirX: 1, dirY: 0 } : defaultAim(game.balls, cue, legalRef.current);
    requestDraw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turnKey]);

  // New shots from the server.
  useEffect(() => {
    if (shots.length) startNext();
  }, [shots, startNext]);

  // The opponent's live aim.
  useEffect(() => onRemoteAim(requestDraw), [requestDraw]);

  // Size the canvas to the box, keeping the table's aspect ratio.
  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const resize = () => {
      const { width, height } = wrap.getBoundingClientRect();
      if (width < 10 || height < 10) return;
      const cssScale = Math.min(width / WORLD_W, height / WORLD_H);
      const cssW = WORLD_W * cssScale;
      const cssH = WORLD_H * cssScale;
      let dpr = Math.min(2, window.devicePixelRatio || 1);
      if (cssW * cssH * dpr * dpr > MAX_BACKING_PIXELS) dpr = Math.sqrt(MAX_BACKING_PIXELS / (cssW * cssH));
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
      const v: View = { scale: cssScale * dpr, dpr, width: canvas.width, height: canvas.height };
      view.current = { v, base: drawStatic(v), sprites: ballSprites(v) };
      draw();
    };
    resize();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [draw]);

  useEffect(
    () => () => {
      if (raf.current !== null) cancelAnimationFrame(raf.current);
      raf.current = null;
      if (sim.current) useTacadaStore.getState().setAnimating(false);
      sim.current = null;
      clearTimeout(live.current.aimTimer);
    },
    [],
  );

  /** Sends the live aim, at most every AIM_SEND_MS (the last change always goes out). */
  const sendAim = useCallback(() => {
    const l = live.current;
    if (!l.interactive) return;
    const emit = () => {
      l.lastAimSent = Date.now();
      l.aimTimer = undefined;
      actions.aim({ dirX: l.aim.dirX, dirY: l.aim.dirY, power: l.power, ...(l.game.ballInHand && l.cue ? { cueX: l.cue[0], cueY: l.cue[1] } : {}) });
    };
    const wait = AIM_SEND_MS - (Date.now() - l.lastAimSent);
    if (wait <= 0) emit();
    else l.aimTimer ??= setTimeout(emit, wait);
  }, [actions]);

  const toWorld = (e: { clientX: number; clientY: number }) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: ((e.clientX - rect.left) / rect.width) * WORLD_W - RAIL, y: ((e.clientY - rect.top) / rect.height) * WORLD_H - RAIL };
  };

  const cuePos = (): [number, number] | null => {
    const l = live.current;
    if (l.game.ballInHand && l.cue) return l.cue;
    const b = l.game.balls[0];
    return b ? [b[0], b[1]] : null;
  };

  const aimAt = (x: number, y: number) => {
    const cue = cuePos();
    if (!cue) return;
    const dx = x - cue[0];
    const dy = y - cue[1];
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 0.8) return;
    live.current.aim = { dirX: dx / len, dirY: dy / len };
    // While going for the 8, the pocket follows the aim until the player taps one.
    const l = live.current;
    if (l.game.onEight && !l.manualPocket) {
      const p = aimPreview(displayBalls(), l.aim.dirX, l.aim.dirY);
      const target = p?.ball === 8 ? l.game.balls[8] : null;
      if (p && target) setPocket(pocketAlong(target[0], target[1], p.objDirX, p.objDirY));
    }
    requestDraw();
    sendAim();
  };

  const rotate = (rad: number) => {
    const { dirX, dirY } = live.current.aim;
    const c = Math.cos(rad);
    const s = Math.sin(rad);
    live.current.aim = { dirX: dirX * c - dirY * s, dirY: dirX * s + dirY * c };
    requestDraw();
    sendAim();
  };

  function onPointerDown(e: ReactPointerEvent<HTMLCanvasElement>) {
    unlockPoolSound();
    const l = live.current;
    if (!l.interactive) return;
    const p = toWorld(e);
    if (l.game.onEight) {
      const hit = TACADA_POCKETS.findIndex((pk) => (pk.x - p.x) ** 2 + (pk.y - p.y) ** 2 < (pk.r + 4) ** 2);
      if (hit >= 0) {
        l.manualPocket = true;
        setPocket(hit);
        return;
      }
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    const cue = cuePos();
    if (l.game.ballInHand && cue && (cue[0] - p.x) ** 2 + (cue[1] - p.y) ** 2 < (R * 2.6) ** 2) {
      l.mode = 'place';
      return;
    }
    l.mode = 'aim';
    aimAt(p.x, p.y);
  }

  function onPointerMove(e: ReactPointerEvent<HTMLCanvasElement>) {
    const l = live.current;
    if (!l.interactive || !l.mode) return;
    const p = toWorld(e);
    if (l.mode === 'aim') return aimAt(p.x, p.y);
    const maxX = l.game.breakShot ? TACADA_KITCHEN_X : TACADA_TABLE_W - R;
    l.cue = [clamp(p.x, R, maxX), clamp(p.y, R, TACADA_TABLE_H - R)];
    requestDraw();
    sendAim();
  }

  function onPointerUp() {
    live.current.mode = null;
  }

  function onWheel(e: React.WheelEvent) {
    if (!live.current.interactive) return;
    rotate((e.deltaY > 0 ? 1 : -1) * (e.shiftKey ? 0.02 : 0.004));
  }

  // --- Power bar: pull down, release to shoot. ---
  const pull = useRef<{ startY: number; height: number } | null>(null);
  const setPower = (power: number) => {
    live.current.power = power;
    if (powerFillRef.current) powerFillRef.current.style.transform = `scaleY(${power})`;
    requestDraw();
    sendAim();
  };

  async function shoot() {
    const l = live.current;
    const power = l.power;
    if (!l.interactive || power < 0.02) return setPower(0);
    if (l.game.ballInHand && l.cue && !canPlaceCue(l.game.balls, l.cue[0], l.cue[1], l.game.breakShot)) {
      setPower(0);
      toast.error(l.game.breakShot ? 'Na saída, a branca fica atrás da linha' : 'A branca não cabe aí: arraste para um lugar livre');
      return;
    }
    if (l.game.onEight && l.pocket === null) {
      setPower(0);
      toast.error('Toque na caçapa onde a 8 vai cair');
      return;
    }
    const shot: TacadaShootInput = { dirX: l.aim.dirX, dirY: l.aim.dirY, power, spinX: l.spin.x, spinY: -l.spin.y };
    if (l.game.ballInHand && l.cue) {
      shot.cueX = l.cue[0];
      shot.cueY = l.cue[1];
    }
    if (l.game.onEight && l.pocket !== null) shot.pocket = l.pocket;
    setSending(true);
    await actions.shoot(shot);
    setSending(false);
    setPower(0);
  }

  function onPowerDown(e: ReactPointerEvent<HTMLDivElement>) {
    unlockPoolSound();
    if (!live.current.interactive) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const rect = powerTrackRef.current!.getBoundingClientRect();
    pull.current = { startY: e.clientY, height: rect.height * 0.92 };
  }
  function onPowerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!pull.current) return;
    setPower(clamp((e.clientY - pull.current.startY) / pull.current.height, 0, 1));
  }
  function onPowerUp() {
    if (!pull.current) return;
    pull.current = null;
    void shoot();
  }
  function onPowerKey(e: KeyboardEvent<HTMLDivElement>) {
    if (!live.current.interactive) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setPower(clamp(live.current.power + (e.key === 'ArrowDown' ? 0.05 : -0.05), 0, 1));
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      rotate((e.key === 'ArrowRight' ? 1 : -1) * (e.shiftKey ? 0.02 : 0.003));
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      void shoot();
    }
  }

  // --- Fine aim: drag the wheel up/down to turn the cue slowly. ---
  const fine = useRef<number | null>(null);
  function onFineDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (!live.current.interactive) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    fine.current = e.clientY;
  }
  function onFineMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (fine.current === null) return;
    const dy = e.clientY - fine.current;
    fine.current = e.clientY;
    rotate(dy * 0.0022);
    e.currentTarget.style.backgroundPositionY = `${(parseFloat(e.currentTarget.style.backgroundPositionY || '0') + dy) % 40}px`;
  }
  function onFineUp() {
    fine.current = null;
  }

  function pickSpin(e: ReactPointerEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    let x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    let y = ((e.clientY - rect.top) / rect.height) * 2 - 1;
    const len = Math.sqrt(x * x + y * y);
    if (len > 0.8) {
      x = (x / len) * 0.8;
      y = (y / len) * 0.8;
    }
    setSpin({ x: x / 0.8, y: y / 0.8 });
  }

  const canAct = interactive;
  const spinDot = { left: `${50 + spin.x * 34}%`, top: `${50 + spin.y * 34}%` };

  return (
    <div className="relative flex h-full w-full items-stretch gap-2">
      <div className="flex w-12 shrink-0 flex-col items-center justify-center gap-1 sm:w-14">
        <span className="text-[10px] font-bold tracking-wider text-white/70 uppercase">Força</span>
        <div
          ref={powerTrackRef}
          role="slider"
          tabIndex={0}
          aria-label="Força da tacada: puxe para baixo e solte para tacar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={0}
          aria-valuetext="Puxe para baixo para dar força"
          aria-disabled={!canAct}
          onPointerDown={onPowerDown}
          onPointerMove={onPowerMove}
          onPointerUp={onPowerUp}
          onPointerCancel={onPowerUp}
          onKeyDown={onPowerKey}
          className={cn(styles.power, 'relative w-10 flex-1 touch-none overflow-hidden rounded-full sm:w-11', canAct ? 'cursor-grab ring-2 ring-amber-300/80' : 'opacity-50')}
        >
          <div ref={powerFillRef} className={styles.powerFill} />
          <span aria-hidden className={styles.powerCue} />
        </div>
      </div>

      <div ref={wrapRef} className="relative flex min-w-0 flex-1 items-center justify-center">
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={myTurn ? 'Mesa de bilhar: arraste para mirar' : 'Mesa de bilhar'}
          className={cn('touch-none rounded-[2%] shadow-[0_20px_50px_rgb(0_0_0/0.55)] select-none', canAct && 'cursor-crosshair')}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onWheel={onWheel}
        />
      </div>

      <div className="flex w-12 shrink-0 flex-col items-center justify-center gap-2 sm:w-14">
        <div className="relative">
          <button
            type="button"
            aria-label="Efeito na bola branca"
            aria-expanded={spinOpen}
            disabled={!canAct}
            onClick={() => setSpinOpen((o) => !o)}
            className="relative size-11 rounded-full bg-[radial-gradient(circle_at_35%_30%,#fff,#e7e5e4_60%,#a8a29e)] shadow-lg ring-2 ring-white/40 disabled:opacity-50"
          >
            <span aria-hidden className="absolute size-2 -translate-1/2 rounded-full bg-rose-600" style={spinDot} />
          </button>
          {spinOpen && (
            <div className="absolute top-1/2 right-full z-30 mr-2 flex -translate-y-1/2 flex-col items-center gap-2 rounded-2xl bg-black/80 p-3 shadow-xl ring-1 ring-white/15 backdrop-blur">
              <span className="text-xs font-bold text-white">Efeito</span>
              <div
                role="application"
                aria-label="Toque na bola onde o taco bate"
                onPointerDown={pickSpin}
                onPointerMove={(e) => e.buttons && pickSpin(e)}
                className="relative size-32 cursor-pointer touch-none rounded-full bg-[radial-gradient(circle_at_35%_30%,#fff,#e7e5e4_60%,#a8a29e)] shadow-inner"
              >
                <span aria-hidden className="absolute inset-[18%] rounded-full border border-dashed border-stone-400" />
                <Crosshair aria-hidden className="absolute size-6 -translate-1/2 text-rose-600" style={spinDot} />
              </div>
              <span className="text-center text-[10px] leading-tight text-white/70">Em cima segue · embaixo volta · lados desviam na tabela</span>
              <div className="flex gap-2">
                <button type="button" className="rounded-lg bg-white/10 px-2 py-1 text-xs text-white" onClick={() => setSpin({ x: 0, y: 0 })}>
                  Centro
                </button>
                <button type="button" className="rounded-lg bg-amber-300 px-2 py-1 text-xs font-bold text-amber-950" onClick={() => setSpinOpen(false)}>
                  Ok
                </button>
              </div>
            </div>
          )}
        </div>
        <span className="text-[10px] font-bold tracking-wider text-white/70 uppercase">Ajuste</span>
        <div
          role="slider"
          tabIndex={-1}
          aria-label="Ajuste fino da mira: arraste para cima ou para baixo"
          aria-valuenow={0}
          aria-disabled={!canAct}
          onPointerDown={onFineDown}
          onPointerMove={onFineMove}
          onPointerUp={onFineUp}
          onPointerCancel={onFineUp}
          className={cn(styles.wheel, 'w-9 flex-1 touch-none rounded-xl', canAct ? 'cursor-ns-resize' : 'opacity-50')}
        />
      </div>
    </div>
  );
}

'use client';

import { DoorOpen, RotateCcw, Volume2, VolumeX, X } from 'lucide-react';
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { BOTAO_TEAMS, BOTAO_TICK_MS, botaoDirFromVector, botaoTeamOf, type BotaoFrame, type BotaoRoomState } from '@/contracts';
import { Button } from '@/components/ui/button';
import { MatchRewardPanel } from '@/features/arena/reward-panel';
import { cn } from '@/lib/utils';
import type { FieldBus } from './bus';
import type { BotaoActions } from './connection';
import { BotaoInput, type Orient } from './input';
import { isMuted, sfx, toggleMute, unlockAudio } from './media/audio';
import { FieldRenderer, WORLD_H, WORLD_W } from './media/renderer';
import { buildView } from './view';

interface Hud {
  score: [number, number];
  clock: number;
  overtime: boolean;
}

interface Banner {
  text: string;
  sub?: string;
  color?: string;
  ms: number;
}

const hudFrom = (f: BotaoFrame): Hud => ({ score: f.score, clock: f.clock, overtime: f.overtime });
const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.max(0, s) % 60).padStart(2, '0')}`;
const minute = (s: number) => `${Math.floor(s / 60) + 1}'`;

/** Controles de toque: joystick flutuante à esquerda, chute (segurar) à direita. */
function TouchControls({ input, portrait }: { input: BotaoInput; portrait: boolean }) {
  const [origin, setOrigin] = useState<{ x: number; y: number; id: number } | null>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const [kicking, setKicking] = useState(false);
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
    input.setTouchBits(botaoDirFromVector(dx, dy, 10));
  };
  const up = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!origin || e.pointerId !== origin.id) return;
    setOrigin(null);
    input.setTouchBits(0);
  };
  const kick = (on: boolean) => (e: ReactPointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (on) e.currentTarget.setPointerCapture?.(e.pointerId);
    input.setTouchKick(on);
    setKicking(on);
    if (on) navigator.vibrate?.(10);
  };

  return (
    <div className={cn('pointer-events-none flex justify-between', portrait ? 'h-40 shrink-0' : 'absolute inset-0')}>
      <div
        role="presentation"
        aria-label="Joystick"
        className={cn('pointer-events-auto relative h-full touch-none', portrait ? 'w-1/2' : 'w-[34%]')}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
      >
        <div
          className="absolute size-28 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white/30 bg-white/10"
          style={origin ? { left: origin.x, top: origin.y } : { left: '50%', top: portrait ? '50%' : '62%' }}
        >
          <div
            className="absolute top-1/2 left-1/2 size-13 rounded-full border-[3px] border-black/70 bg-[radial-gradient(circle_at_35%_35%,#fff,#c8d8c8)] shadow-[0_4px_0_rgb(0_0_0/0.4)]"
            style={{ transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))` }}
          />
        </div>
      </div>
      <div className={cn('pointer-events-auto relative h-full touch-none', portrait ? 'w-1/2' : 'w-[26%]')}>
        <button
          type="button"
          aria-label="Chutar (segure)"
          aria-pressed={kicking}
          onPointerDown={kick(true)}
          onPointerUp={kick(false)}
          onPointerCancel={kick(false)}
          onContextMenu={(e) => e.preventDefault()}
          className={cn(
            'absolute right-5 size-24 rounded-full border-4 text-4xl shadow-[0_6px_0_#000] select-none',
            portrait ? 'top-1/2 -translate-y-1/2' : 'bottom-[18%]',
            kicking ? 'translate-y-1 border-white bg-[radial-gradient(circle_at_35%_30%,#fff,#a7f3d0)] shadow-[0_2px_0_#000]' : 'border-black bg-[radial-gradient(circle_at_35%_30%,#f8fafc,#94a3b8)]',
          )}
        >
          ⚽
        </button>
      </div>
    </div>
  );
}

function Results({ state, mySeat, actions }: { state: BotaoRoomState; mySeat: number; actions: BotaoActions }) {
  const result = state.result!;
  const myTeam = botaoTeamOf(mySeat);
  const winner = BOTAO_TEAMS[result.winner];
  const nameOf = (seat: number | null) => (seat === null ? 'Alguém que saiu' : (state.seats[seat]?.nickname ?? 'Alguém que saiu'));
  const humans = state.seats.filter((s) => s && !s.bot).length;
  const bots = state.seats.filter((s) => s?.bot).length;
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="botao-result-title" className="absolute inset-0 z-30 flex items-center justify-center overflow-y-auto bg-black/70 p-4">
      <div className="glass flex w-full max-w-md flex-col items-center gap-3 p-5 text-center">
        <span aria-hidden className="text-5xl">
          {result.winner === myTeam ? '🏆' : '😓'}
        </span>
        <h2 id="botao-result-title" className="font-display text-marquee text-3xl font-bold">
          {result.winner === myTeam ? 'Vitória!' : 'Derrota'}
        </h2>
        <p className="text-sm font-semibold" style={{ color: winner.color }}>
          Time {winner.name} venceu{result.walkover ? ' por W.O.' : ''}
        </p>
        <p
          className="font-display flex items-center gap-3 text-4xl font-black tabular-nums"
          aria-label={`Placar: ${BOTAO_TEAMS[0].name} ${result.score[0]}, ${BOTAO_TEAMS[1].name} ${result.score[1]}`}
        >
          <span style={{ color: BOTAO_TEAMS[0].color }}>{result.score[0]}</span>
          <span className="text-white/40">×</span>
          <span style={{ color: BOTAO_TEAMS[1].color }}>{result.score[1]}</span>
        </p>
        {result.goals.length > 0 && (
          <ol className="flex max-h-48 w-full flex-col gap-1 overflow-y-auto text-left" aria-label="Gols">
            {result.goals.map((g, i) => (
              <li key={i} className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-1.5 text-sm font-semibold">
                <span aria-hidden>⚽</span>
                <span aria-hidden className="size-3 rounded-full border border-black/60" style={{ background: BOTAO_TEAMS[g.team].color }} />
                <span className="flex-1 truncate">
                  {nameOf(g.scorer)}
                  {g.own && <span className="text-white/60"> (contra)</span>}
                </span>
                <span className="text-white/60 tabular-nums">{minute(g.at)}</span>
              </li>
            ))}
          </ol>
        )}
        {humans >= 2 && bots === 0 && <MatchRewardPanel />}
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

/** A partida: campo no canvas, placar, controles e efeitos. */
export function MatchScreen({ state, mySeat, actions, bus }: { state: BotaoRoomState; mySeat: number; actions: BotaoActions; bus: FieldBus }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<FieldRenderer | null>(null);
  const orientRef = useRef<Orient>(0);
  const stateRef = useRef(state);
  const [input] = useState(() => new BotaoInput());
  const [hud, setHud] = useState<Hud | null>(() => (bus.latest ? hudFrom(bus.latest) : null));
  const [banner, setBanner] = useState<Banner | null>(null);
  const [muted, setMuted] = useState(isMuted);
  const [portrait, setPortrait] = useState(false);
  const [touch, setTouch] = useState(() => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches);
  const myTeam = botaoTeamOf(mySeat);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    bus.setSeat(mySeat);
  }, [bus, mySeat]);

  // Celular/tablet ganha os controles na tela (também ligados no primeiro toque).
  useEffect(() => {
    const onTouch = (e: PointerEvent) => {
      if (e.pointerType === 'touch') setTouch(true);
    };
    window.addEventListener('pointerdown', onTouch, { passive: true });
    return () => window.removeEventListener('pointerdown', onTouch);
  }, []);

  // Teclado; o som destrava no primeiro gesto.
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

  // Canvas do tamanho do palco; em pé o campo gira e o meu time ataca para cima.
  useEffect(() => {
    const cv = canvasRef.current;
    const stage = stageRef.current;
    if (!cv || !stage || !cv.getContext('2d')) return;
    const renderer = new FieldRenderer(cv);
    rendererRef.current = renderer;
    const fit = () => {
      const w = Math.max(1, stage.clientWidth - 8);
      const h = Math.max(1, stage.clientHeight - 8);
      // Gira só quando o campo fica bem maior em pé.
      const upright = Math.min(w / WORLD_H, h / WORLD_W) > Math.min(w / WORLD_W, h / WORLD_H) * 1.15;
      const orient: Orient = upright ? (myTeam === 0 ? 1 : 2) : 0;
      orientRef.current = orient;
      setPortrait(h > w);
      renderer.resize(w, h, orient);
    };
    fit();
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(fit) : null;
    ro?.observe(stage);
    return () => {
      ro?.disconnect();
      rendererRef.current = null;
    };
  }, [touch, myTeam]);

  // Quadros e anúncios → sons e faixas.
  useEffect(() => {
    let started = false;
    let overtime = false;
    return bus.subscribe((e) => {
      if (e.type === 'frame') {
        const f = e.frame;
        if (f.overtime && !overtime) {
          overtime = true;
          setBanner({ text: 'GOL DE OURO!', sub: 'Quem marcar primeiro vence', ms: 2200 });
        }
        for (const ev of f.events) {
          if (ev.k === 'kick') sfx(ev.seat === mySeat ? 'myKick' : 'kick');
          else if (ev.k === 'post') sfx('post');
          else if (ev.k === 'end') sfx('end');
          else if (ev.k === 'whistle') {
            sfx('whistle');
            if (!started) {
              started = true;
              setBanner({ text: 'VALENDO!', ms: 900 });
            }
          }
        }
        if (f.phase === 'countdown' && !started) setBanner((b) => b ?? { text: 'PREPARAR…', ms: 0 });
        return;
      }
      if (e.msg.event === 'botao:goal') {
        const { goal } = e.msg.payload;
        const who = goal.scorer === null ? null : (stateRef.current.seats[goal.scorer]?.nickname ?? null);
        sfx(goal.team === myTeam ? 'goal' : 'concede');
        navigator.vibrate?.(goal.team === myTeam ? [40, 40, 80] : 60);
        setBanner({ text: 'GOOOL!', sub: who ? `${who}${goal.own ? ' (contra)' : ''}` : undefined, color: BOTAO_TEAMS[goal.team].color, ms: 2300 });
      }
    });
  }, [bus, mySeat, myTeam]);

  useEffect(() => {
    if (!banner?.ms) return;
    const id = setTimeout(() => setBanner(null), banner.ms);
    return () => clearTimeout(id);
  }, [banner]);

  // Ticks fixos de 30 Hz para o comando + um desenho por quadro de animação.
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    let hudAt = 0;
    const nameOf = (seat: number) => stateRef.current.seats[seat]?.nickname ?? '?';
    const loop = (now: number) => {
      acc += Math.min(250, now - last);
      last = now;
      while (acc >= BOTAO_TICK_MS) {
        acc -= BOTAO_TICK_MS;
        const inp = input.sample(orientRef.current);
        const seq = bus.predictor.step(bus.latest, inp.d, inp.k);
        if (seq !== null) actions.input(seq, inp);
      }
      const view = buildView(bus.frames, now, { mySeat, me: bus.predictor.render(), meKick: bus.predictor.kicking, nameOf });
      if (view) rendererRef.current?.draw(view, now);
      if (bus.latest && now - hudAt > 200) {
        hudAt = now;
        const next = hudFrom(bus.latest);
        setHud((h) => (h && h.clock === next.clock && h.overtime === next.overtime && h.score[0] === next.score[0] && h.score[1] === next.score[1] ? h : next));
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      raf = 0;
    };
  }, [bus, actions, mySeat, input]);

  const score = hud?.score ?? state.score;
  return (
    <main className="fixed inset-0 z-10 flex flex-col bg-[#2f4f25] text-white select-none">
      <header className="flex shrink-0 items-center gap-2 px-2 pt-[calc(0.25rem+env(safe-area-inset-top))] pb-1">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Sair da partida"
          className="size-9 shrink-0 rounded-full border-2 border-white/70"
          onClick={() => {
            if (window.confirm('Sair da partida?')) void actions.leave();
          }}
        >
          <X aria-hidden className="size-4" />
        </Button>
        <div className="flex flex-1 justify-center">
          <div role="group" aria-label="Placar" className="flex items-stretch overflow-hidden rounded-lg border-2 border-black/70 font-black shadow-[0_3px_0_rgb(0_0_0/0.4)]">
            <span className="grid min-w-10 place-items-center px-2 text-xl tabular-nums" style={{ background: BOTAO_TEAMS[0].color }} aria-label={`${BOTAO_TEAMS[0].name} ${score[0]}`}>
              {score[0]}
            </span>
            <span
              role="timer"
              aria-label={hud?.overtime ? 'Gol de ouro' : 'Tempo restante'}
              className={cn('grid min-w-16 place-items-center bg-white px-2 text-lg text-slate-900 tabular-nums', hud?.overtime && 'bg-amber-300')}
            >
              {hud ? (hud.overtime ? `+${clock(hud.clock)}` : clock(hud.clock)) : clock(state.rules.minutes * 60)}
            </span>
            <span className="grid min-w-10 place-items-center px-2 text-xl tabular-nums" style={{ background: BOTAO_TEAMS[1].color }} aria-label={`${BOTAO_TEAMS[1].name} ${score[1]}`}>
              {score[1]}
            </span>
          </div>
        </div>
        <Button variant="ghost" size="icon" aria-label={muted ? 'Ligar som' : 'Desligar som'} className="size-9 shrink-0 rounded-full border-2 border-white/70" onClick={() => setMuted(toggleMute())}>
          {muted ? <VolumeX aria-hidden className="size-4" /> : <Volume2 aria-hidden className="size-4" />}
        </Button>
      </header>

      <div className="relative flex min-h-0 flex-1 flex-col">
        <div ref={stageRef} className="relative flex min-h-0 flex-1 items-center justify-center">
          <canvas ref={canvasRef} aria-label="Campo" role="img" className="rounded-md shadow-[0_10px_40px_rgb(0_0_0/0.45)]" />
          {banner && (
            <div aria-live="polite" className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center p-4 text-center">
              <p
                key={banner.text}
                className="font-display animate-in zoom-in-50 text-5xl font-black [-webkit-text-stroke:2px_#000] drop-shadow-[0_5px_0_#000] sm:text-7xl"
                style={{ color: banner.color ?? '#fde047' }}
              >
                {banner.text}
              </p>
              {banner.sub && <p className="mt-2 text-xl font-bold drop-shadow-[0_2px_0_#000]">{banner.sub}</p>}
            </div>
          )}
        </div>
        {touch && <TouchControls input={input} portrait={portrait} />}
      </div>

      {state.phase === 'FINISHED' && state.result && <Results state={state} mySeat={mySeat} actions={actions} />}
    </main>
  );
}

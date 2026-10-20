'use client';

import { DoorOpen, RotateCcw, X } from 'lucide-react';
import {
  INF_BUTTON,
  INF_COLS,
  INF_FIX_PANELS,
  INF_HALLS,
  INF_ROOMS,
  INF_ROWS,
  INF_SABOTAGE_INFO,
  INF_SABOTAGES,
  INF_STATIONS,
  type InfFrame,
  type InfRoomState,
  type InfSabotage,
  type InfWinReason,
} from '@/contracts';
import { Button } from '@/components/ui/button';
import { MatchRewardPanel } from '@/features/arena/reward-panel';
import { cn } from '@/lib/utils';
import type { InfActions } from './connection';
import { DiverIcon } from './diver-icon';

/** Role reveal at the start: who you are and, for infiltrators, who your partners are. */
export function IntroOverlay({ state, mySeat, frame }: { state: InfRoomState; mySeat: number; frame: InfFrame }) {
  const imp = frame.me.role === 'impostor';
  const team = imp ? [mySeat, ...frame.me.mates] : state.seats.flatMap((s, i) => (s ? [i] : []));
  const impostors = state.rules.impostors;
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="inf-intro" className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-black/90 p-6 text-center">
      <p className="text-sm font-semibold tracking-[0.3em] text-slate-400 uppercase">Você é</p>
      <h2
        id="inf-intro"
        className={cn('font-display text-5xl font-black tracking-wide drop-shadow-[0_4px_0_#000] sm:text-7xl motion-safe:animate-in motion-safe:zoom-in-50', imp ? 'text-red-500' : 'text-cyan-300')}
      >
        {imp ? 'INFILTRADO' : 'TRIPULANTE'}
      </h2>
      <p className="max-w-md text-slate-200">
        {imp ? 'Elimine a tripulação sem ser visto. Use os dutos e sabote a estação.' : `Faça suas tarefas e descubra ${impostors > 1 ? 'os infiltrados' : 'o infiltrado'} entre vocês.`}
      </p>
      <ul className="flex max-w-xl flex-wrap justify-center gap-2" aria-label={imp ? 'Seu time' : 'Tripulação'}>
        {team.map((seat) => {
          const s = state.seats[seat];
          if (!s) return null;
          return (
            <li key={seat} className="flex flex-col items-center">
              <DiverIcon color={s.color} className="size-14" />
              <span className={cn('max-w-20 truncate text-xs font-bold', imp ? 'text-red-400' : 'text-white')}>{s.nickname}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Someone floats out of the airlock (or nobody, on a tie or skip). */
export function EjectOverlay({ state, frame }: { state: InfRoomState; frame: InfFrame }) {
  const e = frame.eject!;
  const s = e.seat !== null ? state.seats[e.seat] : null;
  const name = s?.nickname ?? 'Alguém';
  const line =
    e.seat === null
      ? e.tie
        ? 'Empate. Ninguém foi ejetado.'
        : 'Ninguém foi ejetado. (Votaram para pular)'
      : e.wasImpostor === null
        ? `${name} foi ejetado.`
        : e.wasImpostor
          ? `${name} era um Infiltrado.`
          : `${name} não era um Infiltrado.`;
  return (
    <div role="dialog" aria-modal="true" aria-label="Ejeção" className="absolute inset-0 z-30 overflow-hidden bg-[radial-gradient(ellipse_at_center,#062a40,#010509)] text-center">
      {/* Bubbles drifting up. */}
      {Array.from({ length: 14 }, (_, i) => (
        <span
          key={i}
          aria-hidden
          className="absolute bottom-0 size-2 rounded-full border border-sky-200/50 motion-safe:animate-[inf-bubble_6s_linear_infinite]"
          style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i * 0.43) % 6}s` }}
        />
      ))}
      {s && (
        <div aria-hidden className="absolute top-1/2 left-0 motion-safe:animate-[inf-float_6s_ease-in_forwards]">
          <DiverIcon color={s.color} className="size-24" />
        </div>
      )}
      <div className="absolute inset-x-0 top-[62%] flex flex-col items-center gap-2 px-4">
        <p className="font-display text-2xl font-bold text-white drop-shadow-[0_2px_0_#000] sm:text-4xl motion-safe:animate-in motion-safe:fade-in motion-safe:duration-1000">{line}</p>
        {e.impostorsLeft !== null && (
          <p className="text-slate-300">
            {e.impostorsLeft} {e.impostorsLeft === 1 ? 'infiltrado restante' : 'infiltrados restantes'}
          </p>
        )}
      </div>
    </div>
  );
}

/** "You were eliminated" flash with who did it. */
export function DeathFlash({ state, by }: { state: InfRoomState; by: number }) {
  const killer = state.seats[by];
  return (
    <div role="alert" className="pointer-events-none absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-red-950/85 text-center motion-safe:animate-in motion-safe:fade-in">
      {killer && <DiverIcon color={killer.color} className="size-28" />}
      <p className="font-display text-4xl font-black text-red-300 drop-shadow-[0_3px_0_#000]">VOCÊ FOI ELIMINADO</p>
      <p className="text-slate-200">Agora você é um fantasma: atravesse paredes e termine suas tarefas.</p>
    </div>
  );
}

const REASON: Record<InfWinReason, string> = {
  tasks: 'Todas as tarefas foram concluídas',
  votes: 'A votação decidiu',
  kills: 'Os infiltrados dominaram a estação',
  sabotage: 'A estação não resistiu à sabotagem',
  left: 'O outro time abandonou a estação',
};

export function ResultsOverlay({ state, mySeat, actions }: { state: InfRoomState; mySeat: number; actions: InfActions }) {
  const r = state.result!;
  const iWasImp = r.impostors.includes(mySeat);
  const won = (r.winner === 'impostor') === iWasImp;
  const humans = state.seats.filter((s) => s && !s.bot).length;
  const seats = state.seats.flatMap((s, seat) => (s ? [{ ...s, seat }] : []));
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="inf-result" className="absolute inset-0 z-40 flex items-center justify-center bg-black/80 p-4">
      <div className="glass flex max-h-full w-full max-w-md flex-col items-center gap-3 overflow-y-auto p-5 text-center">
        <h2 id="inf-result" className={cn('font-display text-4xl font-black drop-shadow-[0_3px_0_#000]', won ? 'text-emerald-300' : 'text-red-400')}>
          {won ? 'VITÓRIA' : 'DERROTA'}
        </h2>
        <p className="font-semibold text-slate-100">
          {r.winner === 'crew' ? 'A tripulação venceu' : 'Os infiltrados venceram'} · {REASON[r.reason]}
        </p>
        <ul className="grid w-full grid-cols-3 gap-2 sm:grid-cols-4" aria-label="Papéis">
          {seats.map((p) => {
            const imp = r.impostors.includes(p.seat);
            return (
              <li key={p.seat} className={cn('flex flex-col items-center rounded-xl px-1 py-1.5', imp ? 'bg-red-500/20 ring-1 ring-red-400/60' : 'bg-white/5')}>
                <DiverIcon color={p.color} className="size-11" />
                <span className="max-w-full truncate text-xs font-bold">{p.nickname}</span>
                <span className={cn('text-[10px] font-black tracking-wide', imp ? 'text-red-300' : 'text-cyan-200')}>{imp ? 'INFILTRADO' : 'TRIPULANTE'}</span>
              </li>
            );
          })}
        </ul>
        {humans >= 2 && <MatchRewardPanel />}
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

const SAB_ICON: Record<InfSabotage, string> = { lights: '💡', oxygen: '🫧', reactor: '☢️' };

/** Station map: rooms, where I am, my tasks and the repairs. Infiltrators sabotage from here. */
export function MapOverlay({ frame, pos, onClose, onSabotage }: { frame: InfFrame; pos: { x: number; y: number } | null; onClose(): void; onSabotage?: (kind: InfSabotage) => void }) {
  const imp = frame.me.role === 'impostor';
  const cd = Math.ceil(frame.me.sabotageCd);
  const canSab = imp && !frame.sabotage && cd <= 0 && frame.phase === 'play';
  return (
    <div role="dialog" aria-modal="true" aria-label="Mapa da estação" className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-black/75 p-3" onClick={onClose}>
      <div className="relative w-full max-w-3xl" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          aria-label="Fechar mapa"
          onClick={onClose}
          className="absolute -top-2 -right-2 z-10 grid size-10 place-items-center rounded-full border-2 border-black bg-white text-slate-900"
        >
          <X aria-hidden className="size-5" />
        </button>
        <svg viewBox={`0 0 ${INF_COLS} ${INF_ROWS}`} className="w-full rounded-2xl border-4 border-slate-950 bg-[#03182a]">
          {[...INF_ROOMS, ...INF_HALLS].map((r, i) => (
            <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} fill={i < INF_ROOMS.length ? '#1f4a66' : '#183447'} stroke="#5aa3c8" strokeWidth="0.15" />
          ))}
          {INF_ROOMS.map((r) => (
            <text key={r.id} x={r.x + r.w / 2} y={r.y + r.h / 2} textAnchor="middle" dominantBaseline="middle" fontSize="1.25" fontWeight="700" fill="#cbe7f5">
              {r.name}
            </text>
          ))}
          <circle cx={INF_BUTTON.x} cy={INF_BUTTON.y} r="0.7" fill="#ef4444" />
          {frame.me.role === 'crew' &&
            frame.me.tasks.filter(([, d]) => !d).map(([st]) => <circle key={st} cx={INF_STATIONS[st].x} cy={INF_STATIONS[st].y} r="0.75" fill="#fde047" stroke="#000" strokeWidth="0.15" />)}
          {frame.sabotage &&
            INF_FIX_PANELS[frame.sabotage.kind].map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r="1" fill="#ef4444" stroke="#fff" strokeWidth="0.2">
                <animate attributeName="r" values="0.8;1.4;0.8" dur="1s" repeatCount="indefinite" />
              </circle>
            ))}
          {pos && <circle cx={pos.x} cy={pos.y} r="0.9" fill="#22d3ee" stroke="#fff" strokeWidth="0.25" />}
        </svg>
      </div>
      {imp && onSabotage && (
        <div className="flex flex-wrap justify-center gap-2" onClick={(e) => e.stopPropagation()}>
          {INF_SABOTAGES.map((kind) => (
            <button
              key={kind}
              type="button"
              disabled={!canSab}
              onClick={() => onSabotage(kind)}
              className="flex h-12 items-center gap-2 rounded-xl border-2 border-black bg-red-600 px-4 font-black text-white shadow-[0_4px_0_#000] disabled:opacity-40"
            >
              <span aria-hidden>{SAB_ICON[kind]}</span> {INF_SABOTAGE_INFO[kind].name.split(' ')[0]}
            </button>
          ))}
          <p className="w-full text-center text-sm text-slate-300">{frame.sabotage ? 'Já há uma sabotagem ativa' : cd > 0 ? `Sabotagem em ${cd}s` : 'Escolha uma sabotagem'}</p>
        </div>
      )}
    </div>
  );
}

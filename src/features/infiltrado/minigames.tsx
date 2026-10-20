'use client';

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { InfTaskType } from '@/contracts';
import { cn } from '@/lib/utils';
import { sfx } from './media/audio';

export interface GameProps {
  onDone(): void;
}

const shuffle = <T,>(list: T[]): T[] => {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

const panel = 'flex w-full flex-col items-center gap-4 rounded-2xl border-4 border-slate-950 bg-slate-800 p-4 shadow-[inset_0_0_0_3px_#334155]';
const hint = 'text-center text-sm font-semibold text-slate-300';

/** Tap a cable on the left, then the plug of the same color on the right. */
function Wires({ onDone }: GameProps) {
  const colors = useMemo(() => ['#ef4444', '#3b82f6', '#facc15', '#a855f7'], []);
  const [right] = useState(() => shuffle([0, 1, 2, 3]));
  const [picked, setPicked] = useState<number | null>(null);
  const [links, setLinks] = useState<number[]>([]);
  useEffect(() => {
    if (links.length === 4) setTimeout(onDone, 250);
  }, [links, onDone]);
  const tapRight = (c: number) => {
    if (picked === null) return;
    if (c === picked) {
      sfx('taskStep');
      setLinks((l) => [...l, c]);
    } else sfx('click');
    setPicked(null);
  };
  return (
    <div className={panel}>
      <p className={hint}>Toque num cabo e depois na tomada da mesma cor</p>
      <div className="relative grid w-full max-w-xs grid-cols-[3rem_1fr_3rem] items-center">
        <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
          {links.map((c) => (
            <line key={c} x1="12" y1={12.5 + c * 25} x2="88" y2={12.5 + right.indexOf(c) * 25} stroke={colors[c]} strokeWidth="5" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          ))}
        </svg>
        <div className="flex flex-col gap-3">
          {colors.map((col, c) => (
            <button
              key={c}
              type="button"
              aria-label={`Cabo ${c + 1}`}
              disabled={links.includes(c)}
              onClick={() => setPicked(c)}
              className={cn('h-10 rounded-r-lg border-2 border-black transition', picked === c && 'ring-4 ring-white', links.includes(c) && 'opacity-80')}
              style={{ background: col }}
            />
          ))}
        </div>
        <span />
        <div className="flex flex-col gap-3">
          {right.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Tomada ${right.indexOf(c) + 1}`}
              disabled={links.includes(c)}
              onClick={() => tapRight(c)}
              className="h-10 rounded-l-lg border-2 border-black"
              style={{ background: colors[c] }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/** Stop the sweeping needle inside the green zone, three times. */
function Dial({ onDone }: GameProps) {
  const [hits, setHits] = useState(0);
  const [zone, setZone] = useState(() => 0.2 + Math.random() * 0.6);
  const [angle, setAngle] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const loop = (now: number) => {
      setAngle((Math.sin((now - start) / 420) + 1) / 2);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  const stop = () => {
    if (Math.abs(angle - zone) < 0.08) {
      sfx('taskStep');
      const next = hits + 1;
      setHits(next);
      if (next >= 3) onDone();
      else setZone(0.15 + Math.random() * 0.7);
    } else sfx('click');
  };
  const deg = (v: number) => -90 + v * 180;
  return (
    <div className={panel}>
      <p className={hint}>Pare o ponteiro na faixa verde ({hits}/3)</p>
      <svg viewBox="-110 -110 220 120" className="w-full max-w-xs" aria-hidden>
        <path d="M -100 0 A 100 100 0 0 1 100 0" fill="none" stroke="#020617" strokeWidth="18" />
        <path
          d={`M ${Math.cos(((deg(zone - 0.08) - 90) * Math.PI) / 180) * 100} ${Math.sin(((deg(zone - 0.08) - 90) * Math.PI) / 180) * 100} A 100 100 0 0 1 ${Math.cos(((deg(zone + 0.08) - 90) * Math.PI) / 180) * 100} ${Math.sin(((deg(zone + 0.08) - 90) * Math.PI) / 180) * 100}`}
          fill="none"
          stroke="#22c55e"
          strokeWidth="18"
        />
        <line x1="0" y1="0" x2="0" y2="-92" stroke="#f8fafc" strokeWidth="5" strokeLinecap="round" transform={`rotate(${deg(angle)})`} />
        <circle r="9" fill="#f59e0b" />
      </svg>
      <button type="button" onClick={stop} className="h-12 w-40 rounded-xl border-4 border-black bg-cyan-400 font-black text-slate-950 shadow-[0_4px_0_#000] active:translate-y-1 active:shadow-none">
        PARAR
      </button>
    </div>
  );
}

/** Press 1 → 9 in order on a scrambled keypad. */
function Keypad({ onDone }: GameProps) {
  const [keys] = useState(() => shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]));
  const [next, setNext] = useState(1);
  const [wrong, setWrong] = useState(false);
  const press = (n: number) => {
    if (n === next) {
      sfx('taskStep');
      if (n === 9) onDone();
      setNext(n + 1);
    } else {
      sfx('click');
      setWrong(true);
      setNext(1);
      setTimeout(() => setWrong(false), 300);
    }
  };
  return (
    <div className={panel}>
      <p className={hint}>Aperte de 1 a 9 em ordem</p>
      <div className={cn('grid grid-cols-3 gap-2', wrong && 'motion-safe:animate-pulse')}>
        {keys.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => press(n)}
            className={cn(
              'size-16 rounded-xl border-4 border-black text-2xl font-black shadow-[0_3px_0_#000] active:translate-y-0.5',
              n < next ? 'bg-emerald-400 text-emerald-950' : wrong ? 'bg-red-400' : 'bg-violet-300 text-slate-950',
            )}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Hold the valve until the tank is full. */
function Fill({ onDone }: GameProps) {
  const [level, setLevel] = useState(0);
  const holding = useRef(false);
  const done = useRef(false);
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      if (holding.current && !done.current)
        setLevel((l) => {
          const n = Math.min(1, l + dt / 2.8);
          if (n >= 1 && !done.current) {
            done.current = true;
            setTimeout(onDone, 150);
          }
          return n;
        });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [onDone]);
  const press = (e: ReactPointerEvent) => {
    e.preventDefault();
    holding.current = true;
  };
  const release = () => {
    holding.current = false;
  };
  return (
    <div className={panel}>
      <p className={hint}>Segure o botão até encher o tanque</p>
      <div className="relative h-44 w-24 overflow-hidden rounded-2xl border-4 border-black bg-slate-950">
        <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-emerald-600 to-emerald-300" style={{ height: `${level * 100}%` }} />
        <span className="absolute inset-0 grid place-items-center text-xl font-black text-white drop-shadow">{Math.round(level * 100)}%</span>
      </div>
      <button
        type="button"
        onPointerDown={press}
        onPointerUp={release}
        onPointerLeave={release}
        onPointerCancel={release}
        className="h-14 w-44 touch-none rounded-xl border-4 border-black bg-emerald-400 font-black text-emerald-950 shadow-[0_4px_0_#000] select-none active:translate-y-1 active:shadow-none"
      >
        SEGURAR
      </button>
    </div>
  );
}

/** Tap every clump of algae off the filter. */
function Clean({ onDone }: GameProps) {
  const [blobs, setBlobs] = useState(() => Array.from({ length: 7 }, (_, i) => ({ id: i, x: 10 + Math.random() * 75, y: 10 + Math.random() * 75 })));
  const pop = (id: number) => {
    sfx('taskStep');
    setBlobs((b) => {
      const n = b.filter((x) => x.id !== id);
      if (n.length === 0) setTimeout(onDone, 200);
      return n;
    });
  };
  return (
    <div className={panel}>
      <p className={hint}>Toque nas algas para limpar o filtro ({blobs.length})</p>
      <div className="relative aspect-square w-full max-w-64 overflow-hidden rounded-full border-8 border-slate-600 bg-[repeating-linear-gradient(0deg,#0f172a_0_6px,#1e293b_6px_12px)]">
        {blobs.map((b) => (
          <button
            key={b.id}
            type="button"
            aria-label="Alga"
            onClick={() => pop(b.id)}
            className="absolute size-11 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-lime-900 bg-[radial-gradient(circle_at_35%_35%,#bef264,#4d7c0f)] motion-safe:animate-pulse"
            style={{ left: `${b.x}%`, top: `${b.y}%` }}
          />
        ))}
      </div>
    </div>
  );
}

/** Start the transfer and wait for the bar. */
function Download({ onDone, seconds = 6 }: GameProps & { seconds?: number }) {
  const [started, setStarted] = useState<number | null>(null);
  const [p, setP] = useState(0);
  useEffect(() => {
    if (started === null) return;
    const id = setInterval(() => {
      const v = Math.min(1, (performance.now() - started) / (seconds * 1000));
      setP(v);
      if (v >= 1) {
        clearInterval(id);
        onDone();
      }
    }, 100);
    return () => clearInterval(id);
  }, [started, onDone, seconds]);
  return (
    <div className={panel}>
      <p className={hint}>{started === null ? 'Transfira os dados do painel' : 'Não se afaste do painel…'}</p>
      <div className="flex w-full max-w-xs items-center gap-2 text-3xl" aria-hidden>
        <span>🗄️</span>
        <div className="h-5 flex-1 overflow-hidden rounded-full border-2 border-black bg-slate-950">
          <div className="h-full bg-sky-400 transition-[width]" style={{ width: `${p * 100}%` }} />
        </div>
        <span>📡</span>
      </div>
      <p className="font-mono text-lg font-bold text-sky-300">{Math.round(p * 100)}%</p>
      {started === null && (
        <button
          type="button"
          onClick={() => setStarted(performance.now())}
          className="h-12 w-44 rounded-xl border-4 border-black bg-sky-400 font-black text-slate-950 shadow-[0_4px_0_#000] active:translate-y-1 active:shadow-none"
        >
          TRANSFERIR
        </button>
      )}
    </div>
  );
}

/** Drag the valve slider onto the target mark. */
function Align({ onDone }: GameProps) {
  const [target] = useState(() => 15 + Math.random() * 70);
  const [value, setValue] = useState(() => (Math.random() < 0.5 ? 2 : 98));
  const ok = Math.abs(value - target) < 4;
  useEffect(() => {
    if (!ok) return;
    const id = setTimeout(onDone, 500);
    return () => clearTimeout(id);
  }, [ok, onDone]);
  return (
    <div className={panel}>
      <p className={hint}>Arraste a válvula até a marca e segure</p>
      <div className="relative w-full max-w-xs pt-6">
        <span aria-hidden className="absolute top-0 h-6 w-1 -translate-x-1/2 rounded bg-pink-400" style={{ left: `${target}%` }} />
        <input type="range" min={0} max={100} step={0.5} value={value} aria-label="Válvula" onChange={(e) => setValue(Number(e.target.value))} className="h-10 w-full accent-pink-400" />
      </div>
      <p className={cn('text-sm font-bold', ok ? 'text-emerald-300' : 'text-slate-400')}>{ok ? 'Alinhado!' : 'Desalinhado'}</p>
    </div>
  );
}

/** Stand on the scanner until it finishes (visible to everyone in the original; here just a wait). */
function Scan({ onDone }: GameProps) {
  return <Download onDone={onDone} seconds={7} />;
}

/** Flip every switch on. */
export function LightsFix({ onDone }: GameProps) {
  const [on, setOn] = useState(() => {
    const s = Array.from({ length: 5 }, () => Math.random() < 0.5);
    if (s.every(Boolean)) s[0] = false;
    return s;
  });
  useEffect(() => {
    if (on.every(Boolean)) onDone();
  }, [on, onDone]);
  return (
    <div className={panel}>
      <p className={hint}>Ligue todos os disjuntores</p>
      <div className="flex gap-2">
        {on.map((v, i) => (
          <button
            key={i}
            type="button"
            aria-pressed={v}
            aria-label={`Disjuntor ${i + 1}`}
            onClick={() => {
              sfx('click');
              setOn((s) => s.map((x, j) => (j === i ? !x : x)));
            }}
            className="flex h-24 w-12 flex-col justify-between rounded-lg border-4 border-black bg-slate-900 p-1"
          >
            <span className={cn('h-9 rounded transition', v ? 'bg-emerald-400' : 'bg-slate-700')} />
            <span className={cn('h-9 rounded transition', v ? 'bg-slate-700' : 'bg-red-500')} />
          </button>
        ))}
      </div>
    </div>
  );
}

/** Type the code shown on the panel. */
export function OxygenFix({ onDone }: GameProps) {
  const [code] = useState(() => Array.from({ length: 5 }, () => Math.floor(Math.random() * 10)).join(''));
  const [typed, setTyped] = useState('');
  const press = (d: string) => {
    sfx('click');
    const next = (typed + d).slice(0, 5);
    setTyped(next);
    if (next.length === 5) {
      if (next === code) onDone();
      else setTimeout(() => setTyped(''), 250);
    }
  };
  return (
    <div className={panel}>
      <p className={hint}>
        Código: <b className="font-mono text-lg tracking-widest text-emerald-300">{code}</b>
      </p>
      <p className="h-8 min-w-36 rounded-lg bg-slate-950 px-3 text-center font-mono text-2xl tracking-[0.4em] text-white">{typed}</p>
      <div className="grid grid-cols-3 gap-2">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'].map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => press(d)}
            className={cn('size-14 rounded-xl border-4 border-black bg-slate-200 text-xl font-black text-slate-900 shadow-[0_3px_0_#000] active:translate-y-0.5', d === '0' && 'col-start-2')}
          >
            {d}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Keep the hand on the scanner; the other one must be held at the same time. */
export function ReactorFix({ holding, otherHeld, onHold }: { holding: boolean; otherHeld: boolean; onHold(on: boolean): void }) {
  const hold = (on: boolean) => (e: ReactPointerEvent) => {
    e.preventDefault();
    if (on !== holding) onHold(on);
  };
  return (
    <div className={panel}>
      <p className={hint}>Segure a mão no scanner. Alguém precisa segurar o outro ao mesmo tempo!</p>
      <button
        type="button"
        onPointerDown={hold(true)}
        onPointerUp={hold(false)}
        onPointerLeave={hold(false)}
        onPointerCancel={hold(false)}
        className={cn('grid size-36 touch-none place-items-center rounded-3xl border-4 border-black text-6xl shadow-[0_5px_0_#000] select-none', holding ? 'bg-sky-300' : 'bg-slate-600')}
      >
        ✋
      </button>
      <p className={cn('text-sm font-bold', otherHeld ? 'text-emerald-300' : 'text-amber-300')}>{otherHeld ? 'O outro scanner está sendo segurado!' : 'Esperando o outro scanner…'}</p>
    </div>
  );
}

export function TaskGame({ type, onDone }: { type: InfTaskType; onDone(): void }) {
  switch (type) {
    case 'wires':
      return <Wires onDone={onDone} />;
    case 'dial':
      return <Dial onDone={onDone} />;
    case 'keypad':
      return <Keypad onDone={onDone} />;
    case 'fill':
      return <Fill onDone={onDone} />;
    case 'clean':
      return <Clean onDone={onDone} />;
    case 'download':
      return <Download onDone={onDone} />;
    case 'align':
      return <Align onDone={onDone} />;
    case 'scan':
      return <Scan onDone={onDone} />;
  }
}

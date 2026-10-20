import { INF_BUTTON, INF_FIX_PANELS, INF_KILL_RANGE, INF_REPORT_RANGE, INF_SABOTAGE_INFO, INF_STATIONS, INF_USE_RANGE, INF_VENTS, infDist, type InfFrame } from '@/contracts';

/** Client checks stay a bit inside the server ranges (prediction and lag). */
const MARGIN = 0.15;

export type UseTarget = { kind: 'task'; station: number } | { kind: 'fix'; panel: number } | { kind: 'reactor'; panel: number } | { kind: 'button' } | { kind: 'vent'; vent: number };

export interface Reach {
  use: UseTarget | null;
  report: number | null;
  kill: number | null;
}

/** What my diver can do right now, standing at `pos`. */
export function reachFrom(frame: InfFrame, pos: { x: number; y: number }): Reach {
  const out: Reach = { use: null, report: null, kill: null };
  const me = frame.me;
  if (frame.phase !== 'play' || me.vent >= 0) return out;
  const imp = me.role === 'impostor';
  const d = (x: number, y: number) => infDist(pos.x, pos.y, x, y);
  let best = Infinity;
  const consider = (dist: number, range: number, target: UseTarget) => {
    if (dist <= range - MARGIN && dist < best) {
      best = dist;
      out.use = target;
    }
  };

  if (!imp)
    for (const [station, done] of me.tasks) {
      if (done) continue;
      const st = INF_STATIONS[station];
      consider(d(st.x, st.y), INF_USE_RANGE, { kind: 'task', station });
    }
  const sab = frame.sabotage;
  if (me.alive && sab) {
    INF_FIX_PANELS[sab.kind].forEach((p, panel) => {
      if (sab.kind === 'reactor') consider(d(p.x, p.y), INF_USE_RANGE, { kind: 'reactor', panel });
      else if (!sab.fixed[panel]) consider(d(p.x, p.y), INF_USE_RANGE + 0.5, { kind: 'fix', panel });
    });
  }
  if (me.alive) consider(d(INF_BUTTON.x, INF_BUTTON.y), INF_USE_RANGE + 0.5, { kind: 'button' });
  if (imp && me.alive) for (const v of INF_VENTS) consider(d(v.x, v.y), INF_USE_RANGE, { kind: 'vent', vent: v.id });

  if (me.alive) {
    let bestBody = Infinity;
    for (const [seat, x, y] of frame.bodies) {
      const dist = d(x, y);
      if (dist <= INF_REPORT_RANGE - MARGIN && dist < bestBody) {
        bestBody = dist;
        out.report = seat;
      }
    }
  }
  if (imp && me.alive) {
    let bestKill = Infinity;
    for (const [seat, x, y, , , flags] of frame.players) {
      if (flags & 3) continue; // ghosts and partners
      const dist = d(x, y);
      if (dist <= INF_KILL_RANGE - MARGIN && dist < bestKill) {
        bestKill = dist;
        out.kill = seat;
      }
    }
  }
  return out;
}

export function actionLabel(t: UseTarget | null, frame: InfFrame | null): string {
  if (!t) return 'USAR';
  switch (t.kind) {
    case 'task':
      return 'TAREFA';
    case 'fix':
    case 'reactor':
      return 'CONSERTAR';
    case 'button':
      return 'REUNIÃO';
    case 'vent':
      return frame?.me.vent === -1 ? 'DUTO' : 'SAIR';
  }
}

/** Is a critical repair running out? */
export const isCritical = (frame: InfFrame | null) => !!frame?.sabotage && INF_SABOTAGE_INFO[frame.sabotage.kind].critical;

/** Spots worth pulsing on the map near me: my tasks, active repairs. */
export function marksFor(frame: InfFrame, pos: { x: number; y: number }): { x: number; y: number; color: string }[] {
  const out: { x: number; y: number; color: string }[] = [];
  if (frame.phase !== 'play') return out;
  if (frame.me.role === 'crew')
    for (const [station, done] of frame.me.tasks) {
      if (done) continue;
      const st = INF_STATIONS[station];
      if (infDist(pos.x, pos.y, st.x, st.y) < 6) out.push({ x: st.x, y: st.y, color: '#fde047' });
    }
  const sab = frame.sabotage;
  if (sab && frame.me.alive)
    INF_FIX_PANELS[sab.kind].forEach((p, i) => {
      if (!sab.fixed[i] || sab.kind === 'reactor') out.push({ x: p.x, y: p.y, color: '#f87171' });
    });
  if (frame.me.role === 'impostor' && frame.me.alive) for (const v of INF_VENTS) if (infDist(pos.x, pos.y, v.x, v.y) < 4) out.push({ x: v.x, y: v.y, color: '#94a3b8' });
  return out;
}

export function arrowsFor(frame: InfFrame): { x: number; y: number; color: string }[] {
  const sab = frame.sabotage;
  if (!sab || frame.phase !== 'play' || !frame.me.alive) return [];
  return INF_FIX_PANELS[sab.kind].filter((_, i) => !sab.fixed[i] || sab.kind === 'reactor').map((p) => ({ x: p.x, y: p.y, color: '#f87171' }));
}

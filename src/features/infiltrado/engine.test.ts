import { INF_BUTTON, INF_FIX_PANELS, INF_STATIONS, INF_VENTS } from '@/contracts';
import { frame, me } from '@/test/infiltrado-fixtures';
import { InfBus, interpolatePlayers } from './bus';
import { InfInputState, joystickVector } from './input';
import { Predictor } from './prediction';
import { arrowsFor, isCritical, marksFor, reachFrom, actionLabel } from './view-model';

describe('Predictor', () => {
  it('moves right away and replays unconfirmed inputs on reconcile', () => {
    const p = new Predictor();
    expect(p.step(frame(), 1, 0)).toBeNull();
    p.reconcile(frame());
    const s1 = p.step(frame(), 1, 0)!;
    p.step(frame(), 1, 0);
    expect(p.pos!.x).toBeGreaterThan(32);
    expect(p.moving).toBe(true);
    expect(p.facing).toBe(1);
    const predicted = p.pos!.x;
    p.reconcile(frame({ me: me({ x: 32.18, lastSeq: s1 }) }));
    expect(p.pos!.x).toBeCloseTo(predicted, 5);
  });

  it('snaps outside play and inside vents', () => {
    const p = new Predictor();
    p.reconcile(frame());
    p.step(frame(), 1, 0);
    p.reconcile(frame({ phase: 'meeting', me: me({ x: 30, y: 18 }) }));
    expect(p.pos).toEqual({ x: 30, y: 18 });
    expect(p.step(frame({ me: me({ vent: 2 }) }), 1, 0)).toBeNull();
  });

  it('lets ghosts through walls', () => {
    const p = new Predictor();
    const ghost = frame({ me: me({ alive: false, x: 24.5, y: 15 }) });
    p.reconcile(ghost);
    for (let i = 0; i < 20; i++) p.step(ghost, -1, 0);
    expect(p.pos!.x).toBeLessThan(23);
  });
});

describe('InfBus and interpolation', () => {
  it('blends visible players between frames and drops who left sight', () => {
    const bus = new InfBus();
    bus.pushFrame(frame({ players: [[3, 10, 10, 1, 1, 0]] }), 0);
    bus.pushFrame(
      frame({
        players: [
          [3, 12, 10, 1, 1, 0],
          [4, 5, 5, -1, 0, 1],
        ],
      }),
      100,
    );
    const at = interpolatePlayers(bus.frames, 50);
    expect(at.get(3)!.x).toBeCloseTo(11);
    expect(at.get(4)).toMatchObject({ x: 5, y: 5, flags: 1 });
    bus.pushFrame(frame({ players: [] }), 150);
    expect(interpolatePlayers(bus.frames, 140).size).toBe(0);
  });

  it('starts over when the phase changes', () => {
    const bus = new InfBus();
    bus.pushFrame(frame(), 0);
    bus.pushFrame(frame({ phase: 'meeting' }), 50);
    expect(bus.frames).toHaveLength(1);
  });
});

describe('input', () => {
  it('merges keys into a unit vector and stops while locked', () => {
    const input = new InfInputState();
    input.onKeyDown(new KeyboardEvent('keydown', { code: 'KeyD' }));
    input.onKeyDown(new KeyboardEvent('keydown', { code: 'KeyS' }));
    const [x, y] = input.sample();
    expect(Math.hypot(x, y)).toBeCloseTo(1);
    input.setLocked(true);
    expect(input.sample()).toEqual([0, 0]);
  });

  it('joystick has a dead zone and saturates at the radius', () => {
    expect(joystickVector(3, 3, 50)).toEqual([0, 0]);
    const [x, y] = joystickVector(100, 0, 50);
    expect([x, y]).toEqual([1, 0]);
    expect(joystickVector(25, 0, 50)[0]).toBeCloseTo(0.5);
  });
});

describe('reachFrom', () => {
  const st = INF_STATIONS[8];
  it('offers my task when standing at its console', () => {
    const r = reachFrom(frame(), { x: st.x + 0.5, y: st.y + 0.5 });
    expect(r.use).toEqual({ kind: 'task', station: 8 });
    expect(actionLabel(r.use, frame())).toBe('TAREFA');
  });

  it('offers the emergency button, report and kill', () => {
    const f = frame({
      me: me({ role: 'impostor' }),
      bodies: [[5, INF_BUTTON.x + 1, INF_BUTTON.y]],
      players: [
        [6, INF_BUTTON.x, INF_BUTTON.y + 1, 1, 0, 0],
        [7, INF_BUTTON.x - 1, INF_BUTTON.y, 1, 0, 2],
      ],
    });
    const r = reachFrom(f, { x: INF_BUTTON.x, y: INF_BUTTON.y });
    expect(r.use).toEqual({ kind: 'button' });
    expect(r.report).toBe(5);
    expect(r.kill).toBe(6); // never the partner (flag 2)
  });

  it('infiltrators see vents, crew never does', () => {
    const v = INF_VENTS[4];
    expect(reachFrom(frame({ me: me({ role: 'impostor', tasks: [] }) }), v).use).toEqual({ kind: 'vent', vent: 4 });
    expect(reachFrom(frame({ me: me({ tasks: [] }) }), v).use).toBeNull();
  });

  it('nothing to do outside play', () => {
    expect(reachFrom(frame({ phase: 'meeting' }), { x: st.x, y: st.y })).toEqual({ use: null, report: null, kill: null });
  });

  it('repairs: open panels and arrows while a sabotage runs', () => {
    const f = frame({ sabotage: { kind: 'oxygen', left: 30, fixed: [1, 0] } });
    const p1 = INF_FIX_PANELS.oxygen[1];
    expect(reachFrom(f, p1).use).toEqual({ kind: 'fix', panel: 1 });
    expect(reachFrom(f, INF_FIX_PANELS.oxygen[0]).use).toBeNull();
    expect(arrowsFor(f)).toHaveLength(1);
    expect(isCritical(f)).toBe(true);
    expect(marksFor(f, { x: 0, y: 0 }).some((m) => m.x === p1.x)).toBe(true);
  });
});

describe('hudKey', () => {
  it('ignores small moves but notices what the HUD shows', async () => {
    const { hudKey } = await import('./game-screen');
    const reach = { use: null, report: null, kill: null };
    const f = frame();
    const base = hudKey(f, reach, { x: 30, y: 18 }, false);
    expect(hudKey(frame(), reach, { x: 30.4, y: 18.2 }, false)).toBe(base);
    expect(hudKey(frame({ me: me({ killCd: 3 }) }), reach, { x: 30, y: 18 }, false)).not.toBe(base);
    expect(hudKey(f, { ...reach, report: 4 }, { x: 30, y: 18 }, false)).not.toBe(base);
    // With the map open my dot moves, so position counts.
    expect(hudKey(f, reach, { x: 31, y: 18 }, true)).not.toBe(hudKey(f, reach, { x: 30, y: 18 }, true));
  });
});

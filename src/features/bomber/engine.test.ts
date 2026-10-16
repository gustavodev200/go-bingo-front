import { BOMBER_TICK_MS } from '@/contracts';
import { frame, framePlayer } from '@/test/bomber-fixtures';
import { ArenaBus } from './bus';
import { BomberInput, joystickDir } from './input';
import { Predictor, worldFrom } from './prediction';
import { reactToAnnouncement, reactToFrame } from './reactions';
import { bracket, buildView, INTERP_MS } from './view';
import { roomState } from '@/test/bomber-fixtures';

describe('worldFrom', () => {
  it('blocks grounded bombs only', () => {
    const w = worldFrom(
      frame({
        bombs: [
          [1, 3, 1, 0, 0, -1, 1],
          [2, 5, 1, 0, [5, 1, 8, 1, 0.5], -1, 1],
          [3, 7, 1, 0, 0, 1, 1],
        ],
      }),
    );
    expect(w.bombAt(3, 1)).not.toBeNull();
    expect(w.bombAt(5, 1)).toBeNull();
    expect(w.bombAt(7, 1)).toBeNull();
  });
});

describe('Predictor', () => {
  it('moves right away and replays unconfirmed inputs on reconcile', () => {
    const p = new Predictor();
    expect(p.step(frame(), 4)).toBeNull(); // no frame applied yet
    p.reconcile(frame(), 0);
    const s1 = p.step(frame(), 4)!;
    const s2 = p.step(frame(), 4)!;
    expect(s2).toBe(s1 + 1);
    expect(p.pos!.x).toBeGreaterThan(1);
    expect(p.moving).toBe(true);
    expect(p.dir).toBe(4);
    const predicted = p.pos!.x;
    // Server confirms only the first input.
    p.reconcile(frame({ players: [framePlayer(0, { x: 1.11, lastSeq: s1 })] }), 0);
    expect(p.pendingCount).toBe(1);
    expect(p.pos!.x).toBeCloseTo(predicted, 1);
    const r = p.render()!;
    expect(r.x).toBeCloseTo(p.pos!.x, 1);
  });

  it('does not act during the countdown, when dead or without me', () => {
    const p = new Predictor();
    p.reconcile(frame({ phase: 'countdown' }), 0);
    expect(p.step(frame({ phase: 'countdown' }), 4)).toBeNull();
    p.reconcile(frame({ players: [framePlayer(0, { alive: 0 })] }), 0);
    expect(p.step(frame(), 4)).toBeNull();
    p.reconcile(frame({ players: [] }), 0);
    expect(p.alive).toBe(false);
    p.reset();
    expect(p.render()).toBeNull();
  });

  it('reverses directions under the reverse curse and snaps big corrections', () => {
    const p = new Predictor();
    p.reconcile(frame({ players: [framePlayer(0, { x: 3, curse: 'reverse' })] }), 0);
    p.step(frame(), 3);
    expect(p.dir).toBe(4);
    p.reconcile(frame({ players: [framePlayer(0, { x: 9, curse: 'reverse' })] }), 0);
    expect(p.render()!.x).toBeGreaterThan(8.9);
    for (let i = 0; i < 100; i++) p.step(frame(), 0);
    expect(p.pendingCount).toBeLessThanOrEqual(90);
  });
});

describe('view', () => {
  const colorOf = (seat: number) => seat + 2;
  const me = { pos: { x: 5, y: 5 }, dir: 3 as const, moving: true };

  it('brackets frames around the render time', () => {
    const fs = [
      { at: 0, frame: frame() },
      { at: 100, frame: frame() },
    ];
    expect(bracket(fs, 50).t).toBeCloseTo(0.5);
    expect(bracket(fs, 500).t).toBe(1);
    expect(bracket(fs, -10).a).toBe(fs[0]);
  });

  it('interpolates others, uses prediction for me and slides bombs', () => {
    const f0 = frame({ players: [framePlayer(0), framePlayer(1, { x: 3 })], bombs: [[1, 3, 3, 0, 0, -1, 0.5]] });
    const f1 = frame({ players: [framePlayer(0), framePlayer(1, { x: 4 })], bombs: [[1, 4, 3, 1, 0, -1, 1]], timeLeft: 40 });
    const view = buildView(
      [
        { at: 1000, frame: f0 },
        { at: 1100, frame: f1 },
      ],
      1050 + INTERP_MS,
      { mySeat: 0, colorOf, me, introLeft: 2 },
    )!;
    const other = view.players.find((p) => p.seat === 1)!;
    expect(other.x).toBeCloseTo(3.5);
    expect(other.color).toBe(3);
    expect(view.players.find((p) => p.seat === 0)).toMatchObject({ x: 5, y: 5, dir: 3, moving: true });
    expect(view.bombs[0]).toMatchObject({ x: 3.5, remote: true, fly: null, heldBy: -1 });
    expect(view.hurry).toBe(true);
    expect(buildView([], 0, { mySeat: 0, colorOf, me, introLeft: 0 })).toBeNull();
  });
});

describe('ArenaBus', () => {
  it('buffers frames, resets on a new round and notifies subscribers', () => {
    const bus = new ArenaBus();
    bus.setSeat(0);
    const seen: string[] = [];
    const off = bus.subscribe((e) => seen.push(e.type));
    bus.pushFrame(frame(), 1);
    bus.pushFrame(frame({ roundNumber: 2 }), 2);
    expect(bus.frames).toHaveLength(1);
    for (let i = 0; i < 50; i++) bus.pushFrame(frame({ roundNumber: 2 }), 3 + i);
    expect(bus.frames.length).toBe(40);
    bus.announce({ event: 'bomber:match_started', payload: { seq: 1 } });
    off();
    bus.pushFrame(frame({ roundNumber: 2 }));
    expect(seen.filter((t) => t === 'announcement')).toHaveLength(1);
    expect(bus.predictor.alive).toBe(true);
  });
});

describe('BomberInput', () => {
  const key = (code: string, type = 'keydown', repeat = false) => new KeyboardEvent(type, { code, repeat, cancelable: true });

  it('keeps the last pressed direction and turns presses into single edges', () => {
    const input = new BomberInput(() => []);
    const detach = input.attach(window);
    window.dispatchEvent(key('ArrowRight'));
    window.dispatchEvent(key('KeyW'));
    window.dispatchEvent(key('Space'));
    window.dispatchEvent(key('Space'));
    window.dispatchEvent(key('Space', 'keydown', true));
    window.dispatchEvent(key('KeyK'));
    expect(input.sample()).toEqual({ d: 1, b: true, a: true });
    expect(input.sample()).toEqual({ d: 1, b: false, a: false });
    expect(input.sample()).toEqual({ d: 1, b: true, a: false });
    window.dispatchEvent(key('KeyW', 'keyup'));
    expect(input.sample().d).toBe(4);
    window.dispatchEvent(new Event('blur'));
    expect(input.sample().d).toBe(0);
    detach();
    window.dispatchEvent(key('ArrowUp'));
    window.dispatchEvent(key('KeyQ'));
    expect(input.sample().d).toBe(0);
  });

  it('ignores typing in text fields and merges touch and gamepad', () => {
    let pad: Partial<Gamepad> | null = null;
    const input = new BomberInput(() => [pad as Gamepad]);
    const field = document.createElement('input');
    document.body.append(field);
    const detach = input.attach(window);
    field.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowUp', bubbles: true }));
    expect(input.sample().d).toBe(0);
    input.setTouchDir(3);
    input.pressBomb();
    input.pressAction();
    expect(input.sample()).toEqual({ d: 3, b: true, a: true });
    input.setTouchDir(0);
    expect(input.sample()).toEqual({ d: 0, b: false, a: false });
    const btn = (pressed: boolean) => ({ pressed }) as GamepadButton;
    pad = { connected: true, axes: [0.9, 0.1], buttons: [btn(true), btn(false)] };
    expect(input.sample()).toMatchObject({ d: 4, b: true });
    pad = { connected: true, axes: [0, -0.9], buttons: [btn(false), btn(true)] };
    expect(input.sample()).toMatchObject({ d: 1, a: true });
    pad = { connected: true, axes: [0, 0], buttons: [...Array(14)].map((_, i) => btn(i === 13)) };
    expect(input.sample().d).toBe(2);
    pad = { connected: true, axes: [0.1, 0.1], buttons: [] };
    expect(input.sample().d).toBe(0);
    detach();
    field.remove();
  });

  it('maps the joystick vector to a direction with a dead zone', () => {
    expect(joystickDir(3, 3)).toBe(0);
    expect(joystickDir(30, 5)).toBe(4);
    expect(joystickDir(-30, 5)).toBe(3);
    expect(joystickDir(5, 30)).toBe(2);
    expect(joystickDir(5, -30)).toBe(1);
  });
});

describe('reactions', () => {
  it('turns frame events into sounds, shake, banners and toasts for me', () => {
    const r = reactToFrame(
      frame({
        events: [
          { k: 'boom', x: 1, y: 1 },
          { k: 'place' },
          { k: 'go' },
          { k: 'die', seat: 0, cause: 'fire' },
          { k: 'item', seat: 0, c: 'B' },
          { k: 'item', seat: 1, c: 'F' },
        ],
      }),
      0,
    );
    expect(r.sfx).toEqual(['boom', 'place', 'go', 'die', 'item']);
    expect(r.shake).toBeGreaterThan(0);
    expect(r.banner?.text).toBe('VAI!');
    expect(r.vibrate).toBeDefined();
    expect(r.toast).toBe('Bomba +1');
    const hurry = reactToFrame(frame({ events: [{ k: 'hurry' }, { k: 'item', seat: 0, c: 'X', curse: 'slow' }, { k: 'item', seat: 0, c: 'X' }] }), 0);
    expect(hurry.musicFast).toBe(true);
    expect(hurry.toast).toContain('Amaldiçoado');
  });

  it('announces rounds, winners and draws', () => {
    const state = roomState();
    expect(reactToAnnouncement({ event: 'bomber:round_started', payload: { seq: 1, roundNumber: 2 } }, state, 0).banner?.text).toBe('RODADA 2');
    const wins = [1, 0, 0, 0, 0, 0, 0, 0];
    expect(reactToAnnouncement({ event: 'bomber:round_ended', payload: { seq: 2, roundNumber: 1, winner: 0, wins } }, state, 0).banner).toMatchObject({ text: 'VOCÊ VENCEU!', sub: '🏆 1 / 3', tone: 'win' });
    expect(reactToAnnouncement({ event: 'bomber:round_ended', payload: { seq: 2, roundNumber: 1, winner: 1, wins } }, state, 0).banner?.text).toBe('BIA VENCEU!');
    expect(reactToAnnouncement({ event: 'bomber:round_ended', payload: { seq: 2, roundNumber: 1, winner: 5, wins } }, null, 0).banner?.text).toBe('ALGUÉM VENCEU!');
    expect(reactToAnnouncement({ event: 'bomber:round_ended', payload: { seq: 2, roundNumber: 1, winner: null, wins } }, state, 0).banner?.text).toBe('EMPATE!');
    expect(reactToAnnouncement({ event: 'bomber:match_over', payload: { seq: 3, winner: 0, wins } }, state, 0).sfx).toEqual(['win']);
    expect(reactToAnnouncement({ event: 'bomber:player_reconnected', payload: { seq: 4, seat: 1 } }, state, 0).sfx).toEqual([]);
  });
});

it('ticks match the server rate', () => {
  expect(BOMBER_TICK_MS).toBeCloseTo(33.3, 1);
});

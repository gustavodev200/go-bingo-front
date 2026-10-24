import { BOTAO_DOWN, BOTAO_LEFT, BOTAO_PLAYER_R, BOTAO_RIGHT, BOTAO_UP } from '@/contracts';
import { frame, framePlayer } from '@/test/botao-fixtures';
import { FieldBus } from './bus';
import { BotaoInput, screenBitsToWorld, toScreen, toWorld } from './input';
import { Predictor } from './prediction';
import { bracket, buildView, INTERP_MS } from './view';

const key = (code: string, extra: Partial<KeyboardEvent> = {}) => ({ code, preventDefault: vi.fn(), target: null, ...extra }) as unknown as KeyboardEvent;

describe('orientation', () => {
  it('toWorld undoes toScreen in every orientation', () => {
    for (const o of [0, 1, 2] as const) {
      const [sx, sy] = toScreen(3, -7, o);
      expect(toWorld(sx, sy, o)).toEqual([3, -7]);
    }
  });

  it('upright, "up" on the screen attacks: right for red, left for blue', () => {
    expect(screenBitsToWorld(BOTAO_UP, 0)).toBe(BOTAO_UP);
    expect(screenBitsToWorld(BOTAO_UP, 1)).toBe(BOTAO_RIGHT);
    expect(screenBitsToWorld(BOTAO_UP, 2)).toBe(BOTAO_LEFT);
    expect(screenBitsToWorld(BOTAO_RIGHT, 1)).toBe(BOTAO_DOWN);
    expect(screenBitsToWorld(BOTAO_UP | BOTAO_RIGHT, 1)).toBe(BOTAO_RIGHT | BOTAO_DOWN);
    expect(screenBitsToWorld(0, 1)).toBe(0);
  });
});

describe('BotaoInput', () => {
  it('merges held keys into direction bits and holds the kick', () => {
    const input = new BotaoInput(() => []);
    input.onKeyDown(key('ArrowUp'));
    input.onKeyDown(key('KeyD'));
    input.onKeyDown(key('Space'));
    expect(input.sample()).toEqual({ d: BOTAO_UP | BOTAO_RIGHT, k: true });
    input.onKeyUp(key('Space'));
    input.onKeyUp(key('ArrowUp'));
    expect(input.sample()).toEqual({ d: BOTAO_RIGHT, k: false });
    input.onKeyDown(key('KeyQ'));
    const typing = document.createElement('input');
    input.onKeyDown(key('ArrowLeft', { target: typing }));
    input.reset();
    expect(input.sample()).toEqual({ d: 0, k: false });
  });

  it('uses the touch stick and button, then the gamepad', () => {
    const buttons = Array.from({ length: 16 }, () => ({ pressed: false }));
    const pad = { connected: true, buttons, axes: [0.9, 0] } as unknown as Gamepad;
    const input = new BotaoInput(() => [null, pad]);
    expect(input.sample()).toEqual({ d: BOTAO_RIGHT, k: false });
    buttons[12].pressed = true;
    buttons[0].pressed = true;
    expect(input.sample()).toEqual({ d: BOTAO_UP, k: true });
    input.setTouchBits(BOTAO_DOWN);
    input.setTouchKick(true);
    expect(input.sample(1)).toEqual({ d: BOTAO_LEFT, k: true });
  });

  it('attaches and detaches its window listeners', () => {
    const add = vi.spyOn(window, 'addEventListener');
    const remove = vi.spyOn(window, 'removeEventListener');
    const detach = new BotaoInput(() => []).attach(window);
    expect(add).toHaveBeenCalledTimes(3);
    detach();
    expect(remove).toHaveBeenCalledTimes(3);
    expect(new BotaoInput().sample()).toEqual({ d: 0, k: false });
  });
});

describe('Predictor', () => {
  it('moves my disc at once and replays unacknowledged inputs on each frame', () => {
    const p = new Predictor();
    expect(p.step(frame(), BOTAO_RIGHT, false)).toBeNull();
    p.reconcile(frame(), 0);
    expect(p.render()).toEqual({ x: -150, y: 0 });
    expect(p.step(frame(), BOTAO_RIGHT, false)).toBe(1);
    expect(p.step(frame(), BOTAO_RIGHT, true)).toBe(2);
    expect(p.kicking).toBe(true);
    const ahead = p.disc!.x;
    expect(ahead).toBeGreaterThan(-150);
    // O servidor só viu o primeiro: o segundo é refeito em cima da posição oficial.
    p.reconcile(frame({ players: [framePlayer(0, { x: -149.9, vx: 0.2, lastSeq: 1 })] }), 0);
    expect(p.pendingCount).toBe(1);
    expect(p.render()!.x).toBeCloseTo(ahead, 0);
  });

  it('snaps on big corrections, waits during the countdown and forgets a missing disc', () => {
    const p = new Predictor();
    p.reconcile(frame(), 0);
    p.step(frame(), BOTAO_RIGHT, false);
    p.reconcile(frame({ players: [framePlayer(0, { x: 100 })] }), 0);
    expect(p.render()!.x).toBeCloseTo(100 + 0.2 * 0.85, 0);
    expect(p.step(frame({ phase: 'countdown' }), BOTAO_RIGHT, false)).toBeNull();
    p.reconcile(frame({ phase: 'countdown' }), 0);
    expect(p.pendingCount).toBe(0);
    p.reconcile(frame({ players: [] }), 0);
    expect(p.render()).toBeNull();
  });

  it('respects the kickoff barrier like the server', () => {
    const p = new Predictor();
    p.reconcile(frame({ phase: 'kickoff', kickTeam: 1, players: [framePlayer(0, { x: -BOTAO_PLAYER_R - 1 })] }), 0);
    for (let i = 0; i < 30; i++) p.step(frame({ phase: 'kickoff', kickTeam: 1 }), BOTAO_RIGHT, false);
    expect(p.disc!.x).toBeLessThanOrEqual(-BOTAO_PLAYER_R);
  });
});

describe('view', () => {
  it('brackets the render time between two frames', () => {
    const frames = [
      { at: 100, frame: frame() },
      { at: 133, frame: frame() },
    ];
    expect(bracket(frames, 116.5).t).toBeCloseTo(0.5);
    expect(bracket(frames, 50).a).toBe(frames[0]);
    expect(bracket(frames, 500).t).toBe(1);
  });

  it('interpolates others and the ball, draws me from the prediction, skips teleports', () => {
    const f0 = frame({ players: [framePlayer(0), framePlayer(4, { x: 100 })], ball: [0, 0, 0, 0] });
    const f1 = frame({ players: [framePlayer(0), framePlayer(4, { x: 110, kick: 1 })], ball: [10, 0, 0, 0] });
    const frames = [
      { at: 0, frame: f0 },
      { at: 40, frame: f1 },
    ];
    const nameOf = (seat: number) => (seat === 0 ? 'ana' : 'Edu');
    const v = buildView(frames, 20 + INTERP_MS, { mySeat: 0, me: { x: -1, y: 2 }, meKick: true, nameOf })!;
    expect(v.ball.x).toBeCloseTo(5);
    const edu = v.players.find((p) => p.seat === 4)!;
    expect(edu).toMatchObject({ team: 1, label: 'E', kick: true, me: false });
    expect(edu.x).toBeCloseTo(105);
    expect(v.players.find((p) => p.seat === 0)).toMatchObject({ x: -1, y: 2, kick: true, me: true, label: 'A' });

    const reset = [
      { at: 0, frame: frame({ ball: [300, 0, 0, 0] }) },
      { at: 40, frame: frame({ ball: [0, 0, 0, 0] }) },
    ];
    expect(buildView(reset, 20 + INTERP_MS, { mySeat: 9, me: null, meKick: false, nameOf: () => ' ' })!.ball.x).toBe(0);
    expect(buildView([], 0, { mySeat: 0, me: null, meKick: false, nameOf })).toBeNull();
  });
});

describe('FieldBus', () => {
  it('buffers frames, feeds the predictor and notifies subscribers', () => {
    const bus = new FieldBus();
    const seen = vi.fn();
    const off = bus.subscribe(seen);
    expect(bus.latest).toBeNull();
    bus.pushFrame(frame(), 1);
    expect(bus.predictor.disc).toBeNull();
    bus.setSeat(0);
    bus.pushFrame(frame(), 2);
    expect(bus.predictor.disc).not.toBeNull();
    for (let i = 0; i < 50; i++) bus.pushFrame(frame(), 3 + i);
    expect(bus.frames).toHaveLength(40);
    bus.announce({ event: 'botao:match_started', payload: { seq: 1 } });
    expect(seen).toHaveBeenLastCalledWith({ type: 'announcement', msg: { event: 'botao:match_started', payload: { seq: 1 } } });
    off();
    bus.pushFrame(frame());
    expect(seen).toHaveBeenCalledTimes(53);
  });
});

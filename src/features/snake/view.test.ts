import { SNAKE_TICK_MS, type SnakeFrame, type SnakeFrameFoodIn, type SnakeFrameSnake } from '@/contracts';
import { INTERP_DELAY_MS, lerpAngle, SnakeView } from './view';

function snake(id: number, head: [number, number], extra: Partial<SnakeFrameSnake> = {}): SnakeFrameSnake {
  const pts = new Map<number, [number, number]>([
    [0, head],
    [1, [head[0] - 5, head[1]]],
  ]);
  return { id, radius: 12, boost: false, angle: 0, total: 2, pts, ...extra };
}

function frame(tick: number, snakes: SnakeFrameSnake[], foods: SnakeFrameFoodIn[] = [], extra: Partial<SnakeFrame> = {}): SnakeFrame {
  return {
    tick,
    myId: 0,
    myMass: 0,
    camX: 0,
    camY: 0,
    snakes: new Map(snakes.map((s) => [s.id, s])),
    foods: new Map(foods.map((f) => [f.id, f])),
    ...extra,
  };
}

describe('SnakeView', () => {
  it('has nothing to show before the first frame', () => {
    expect(new SnakeView().scene(0, 0)).toBeNull();
  });

  it('interpolates between frames in the past and orders points tail to head', () => {
    const v = new SnakeView();
    v.setMeta([[1, 'Ana', 3]]);
    v.push(frame(10, [snake(1, [0, 0])], [], { camX: 0 }), 1000);
    v.push(frame(11, [snake(1, [10, 0])], [], { camX: 10 }), 1000 + SNAKE_TICK_MS);
    // halfway between the two frames once the delay is accounted for
    const s = v.scene(1000 + INTERP_DELAY_MS + SNAKE_TICK_MS / 2, 0)!;
    expect(s.snakes[0]).toMatchObject({
      id: 1,
      name: 'Ana',
      skin: 3,
      isMe: false,
    });
    const head = s.snakes[0].pts.at(-1)!;
    expect(head[0]).toBe(0);
    expect(head[1]).toBeCloseTo(5);
    expect(s.cam[0]).toBeCloseTo(5);
  });

  it('marks my snake, makes it look at the input angle and draws it on top', () => {
    const v = new SnakeView();
    v.myId = 2;
    v.push(frame(1, [snake(2, [0, 0], { radius: 10 }), snake(1, [100, 0], { radius: 30 })], [], { myMass: 44 }), 0);
    const s = v.scene(INTERP_DELAY_MS, 1.5)!;
    expect(s.me?.id).toBe(2);
    expect(s.me?.look).toBe(1.5);
    expect(s.snakes.at(-1)?.id).toBe(2);
    expect(v.myMass).toBe(44);
  });

  it('animates pellets eaten next to a head and fades them out', () => {
    const v = new SnakeView();
    const food = { id: 7, x: 20, y: 0, v: 2, c: 1 };
    v.push(frame(1, [snake(1, [0, 0])], [food]), 0);
    v.push(frame(2, [snake(1, [10, 0])]), SNAKE_TICK_MS);
    let s = v.scene(SNAKE_TICK_MS + INTERP_DELAY_MS, 0)!;
    expect(s.bits).toHaveLength(1);
    s = v.scene(SNAKE_TICK_MS + INTERP_DELAY_MS + 1000, 0)!;
    expect(s.bits).toHaveLength(0);
  });

  it('a snake that dies on screen flashes out for a moment', () => {
    const v = new SnakeView();
    v.push(frame(1, [snake(1, [0, 0])]), 0);
    v.scene(INTERP_DELAY_MS, 0);
    v.onDeath(1, 100);
    v.onDeath(99, 100);
    expect(v.scene(INTERP_DELAY_MS + 10, 0)!.ghosts).toHaveLength(1);
    expect(v.scene(2000, 0)!.ghosts).toHaveLength(0);
  });

  it('resets the clock and buffers', () => {
    const v = new SnakeView();
    v.push(frame(1, []), 0);
    expect(v.latest).not.toBeNull();
    v.reset();
    expect(v.latest).toBeNull();
    expect(v.scene(0, 0)).toBeNull();
  });

  it('keeps a bounded buffer', () => {
    const v = new SnakeView();
    for (let i = 0; i < 50; i++) v.push(frame(i, []), i * SNAKE_TICK_MS);
    v.scene(50 * SNAKE_TICK_MS, 0);
    expect(v.latest?.tick).toBe(49);
  });
});

describe('SnakeView network smoothing', () => {
  it('keeps moving past the newest frame for a moment instead of freezing', () => {
    const v = new SnakeView();
    v.push(frame(1, [snake(1, [0, 0])]), 0);
    v.push(frame(2, [snake(1, [10, 0])]), SNAKE_TICK_MS);
    // half a tick after the newest frame should be shown: extrapolated to x = 15
    const head = v.scene(SNAKE_TICK_MS * 1.5 + INTERP_DELAY_MS, 0)!.snakes[0].pts.at(-1)!;
    expect(head[1]).toBeCloseTo(15);
    // never more than 0.6 of a tick ahead
    const far = v.scene(10_000, 0)!.snakes[0].pts.at(-1)!;
    expect(far[1]).toBeCloseTo(16);
  });

  it('shows the arena further in the past when frames arrive late, then recovers slowly', () => {
    const v = new SnakeView();
    let now = 0;
    for (let tick = 1; tick <= 40; tick++) {
      now = tick * SNAKE_TICK_MS + (tick % 2 ? 0 : 120); // every other frame 120 ms late
      v.push(frame(tick, []), now);
    }
    expect(v.delay).toBeGreaterThan(INTERP_DELAY_MS + 60);
    const high = v.delay;
    for (let tick = 41; tick <= 80; tick++) v.push(frame(tick, []), tick * SNAKE_TICK_MS);
    expect(v.delay).toBeLessThan(high);
    expect(v.delay).toBeGreaterThan(INTERP_DELAY_MS);
  });
});

describe('lerpAngle', () => {
  it('takes the short way around', () => {
    expect(lerpAngle(3, -3, 0.5)).toBeCloseTo(Math.PI, 1);
    expect(lerpAngle(-3, 3, 0.5)).toBeCloseTo(-Math.PI, 1);
  });
});

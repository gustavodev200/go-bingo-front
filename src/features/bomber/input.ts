const KEY_DIR: Record<string, number> = {
  ArrowUp: 1,
  KeyW: 1,
  ArrowDown: 2,
  KeyS: 2,
  ArrowLeft: 3,
  KeyA: 3,
  ArrowRight: 4,
  KeyD: 4,
};
const KEY_BOMB = new Set(['Space', 'KeyJ', 'KeyZ', 'Enter', 'NumpadEnter']);
const KEY_ACTION = new Set(['KeyK', 'KeyX', 'ShiftLeft', 'ShiftRight']);

export interface TickInput {
  d: number;
  b: boolean;
  a: boolean;
}

type GamepadSource = () => (Gamepad | null)[];

const isTyping = (target: EventTarget | null) => target instanceof HTMLElement && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA');

function padDir(gp: Gamepad): number {
  const pressed = (i: number) => !!gp.buttons[i]?.pressed;
  for (const [button, dir] of [
    [12, 1],
    [13, 2],
    [14, 3],
    [15, 4],
  ])
    if (pressed(button)) return dir;
  const ax = gp.axes[0] ?? 0;
  const ay = gp.axes[1] ?? 0;
  if (Math.max(Math.abs(ax), Math.abs(ay)) <= 0.45) return 0;
  if (Math.abs(ax) > Math.abs(ay)) return ax > 0 ? 4 : 3;
  return ay > 0 ? 2 : 1;
}

/**
 * Keyboard, gamepad and on-screen controls merged into one input per network tick.
 * Each button press becomes one "pressed" tick followed by a released one, so
 * the server always sees a rising edge per press, even for quick taps.
 */
export class BomberInput {
  private keys: number[] = [];
  private bombPresses = 0;
  private actionPresses = 0;
  private lastB = false;
  private lastA = false;
  private padPrev = { b: false, a: false };
  /** Direction from the virtual joystick. */
  touchDir = 0;

  setTouchDir(dir: number): void {
    this.touchDir = dir;
  }

  constructor(private readonly gamepads: GamepadSource = () => (typeof navigator !== 'undefined' && navigator.getGamepads ? [...navigator.getGamepads()] : [])) {}

  pressBomb(): void {
    this.bombPresses++;
  }

  pressAction(): void {
    this.actionPresses++;
  }

  onKeyDown = (e: KeyboardEvent): void => {
    if (isTyping(e.target)) return;
    const d = KEY_DIR[e.code];
    if (d) {
      if (!this.keys.includes(d)) this.keys.push(d);
    } else if (KEY_BOMB.has(e.code)) {
      if (!e.repeat) this.bombPresses++;
    } else if (KEY_ACTION.has(e.code)) {
      if (!e.repeat) this.actionPresses++;
    } else return;
    e.preventDefault();
  };

  onKeyUp = (e: KeyboardEvent): void => {
    const d = KEY_DIR[e.code];
    if (d) this.keys = this.keys.filter((k) => k !== d);
  };

  /** Forget held keys (window lost focus, tab hidden, round restarted). */
  reset = (): void => {
    this.keys = [];
    this.touchDir = 0;
    this.bombPresses = this.actionPresses = 0;
  };

  attach(target: Window): () => void {
    target.addEventListener('keydown', this.onKeyDown);
    target.addEventListener('keyup', this.onKeyUp);
    target.addEventListener('blur', this.reset);
    return () => {
      target.removeEventListener('keydown', this.onKeyDown);
      target.removeEventListener('keyup', this.onKeyUp);
      target.removeEventListener('blur', this.reset);
    };
  }

  private pollPad(): number {
    const gp = this.gamepads().find((p) => p?.connected);
    if (!gp) return 0;
    const b = !!(gp.buttons[0]?.pressed || gp.buttons[3]?.pressed);
    const a = !!(gp.buttons[1]?.pressed || gp.buttons[2]?.pressed || gp.buttons[5]?.pressed);
    if (b && !this.padPrev.b) this.bombPresses++;
    if (a && !this.padPrev.a) this.actionPresses++;
    this.padPrev = { b, a };
    return padDir(gp);
  }

  sample(): TickInput {
    const pad = this.pollPad();
    const d = this.keys[this.keys.length - 1] || this.touchDir || pad;
    const b = this.bombPresses > 0 && !this.lastB;
    const a = this.actionPresses > 0 && !this.lastA;
    if (b) this.bombPresses--;
    if (a) this.actionPresses--;
    this.lastB = b;
    this.lastA = a;
    return { d, b, a };
  }
}

/** Joystick vector (px from where the finger went down) → direction, with a dead zone. */
export function joystickDir(dx: number, dy: number, deadZone = 14): number {
  if (Math.hypot(dx, dy) <= deadZone) return 0;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 4 : 3;
  return dy > 0 ? 2 : 1;
}

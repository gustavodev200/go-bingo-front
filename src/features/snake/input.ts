const BOOST_KEYS = new Set(['Space', 'ShiftLeft', 'ShiftRight', 'KeyJ']);
const STEER_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

/** Minimal gamepad shape (navigator.getGamepads entries). */
export interface PadLike {
  axes: readonly number[];
  buttons: readonly { pressed: boolean }[];
}

/**
 * Steering for the snake: an absolute heading plus boost. Mouse (the snake
 * follows the cursor), keyboard, gamepad and the on-screen stick/button.
 */
export class SnakeInput {
  angle = 0;
  boost = false;
  private keys = new Set<string>();
  private keyBoost = false;
  private mouseBoost = false;
  private mouse: [number, number] | null = null;
  private touchAngle: number | null = null;
  private touchBoost = false;

  /** Starts listening; returns the cleanup. */
  attach(target: Window, canvas: HTMLElement): () => void {
    const keydown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (BOOST_KEYS.has(e.code)) {
        this.keyBoost = true;
        e.preventDefault();
      } else if (STEER_KEYS.has(e.code)) {
        this.keys.add(e.code);
        e.preventDefault();
      }
    };
    const keyup = (e: KeyboardEvent) => {
      if (BOOST_KEYS.has(e.code)) this.keyBoost = false;
      this.keys.delete(e.code);
    };
    const move = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') this.mouse = [e.clientX, e.clientY];
    };
    const down = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') this.mouseBoost = true;
    };
    const up = () => {
      this.mouseBoost = false;
    };
    const menu = (e: Event) => e.preventDefault();
    const blur = () => this.reset();
    target.addEventListener('keydown', keydown);
    target.addEventListener('keyup', keyup);
    target.addEventListener('pointerup', up);
    target.addEventListener('blur', blur);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('contextmenu', menu);
    return () => {
      target.removeEventListener('keydown', keydown);
      target.removeEventListener('keyup', keyup);
      target.removeEventListener('pointerup', up);
      target.removeEventListener('blur', blur);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('contextmenu', menu);
    };
  }

  reset(): void {
    this.keys.clear();
    this.keyBoost = this.mouseBoost = this.touchBoost = false;
    this.touchAngle = null;
  }

  /** On-screen stick: a heading while dragged, null when released (the snake keeps going). */
  setTouchAngle(angle: number | null): void {
    this.touchAngle = angle;
    if (angle !== null) this.mouse = null;
  }

  setTouchBoost(on: boolean): void {
    this.touchBoost = on;
  }

  /**
   * Reads every source for this frame. `head` is the screen point of my head
   * (the mouse heading is measured from it). Priority: keys, stick/pad, mouse.
   */
  update(head: [number, number], pads: readonly (PadLike | null)[] = []): void {
    let padBoost = false;
    let padAngle: number | null = null;
    for (const p of pads) {
      if (!p) continue;
      const x = p.axes[0] ?? 0;
      const y = p.axes[1] ?? 0;
      if (Math.hypot(x, y) > 0.35) padAngle = Math.atan2(y, x);
      padBoost ||= [0, 5, 7].some((i) => p.buttons[i]?.pressed);
    }
    const k = this.keys;
    const kx = Number(k.has('KeyD') || k.has('ArrowRight')) - Number(k.has('KeyA') || k.has('ArrowLeft'));
    const ky = Number(k.has('KeyS') || k.has('ArrowDown')) - Number(k.has('KeyW') || k.has('ArrowUp'));
    if (kx || ky) this.angle = Math.atan2(ky, kx);
    else if (this.touchAngle !== null) this.angle = this.touchAngle;
    else if (padAngle !== null) this.angle = padAngle;
    else if (this.mouse) {
      const dx = this.mouse[0] - head[0];
      const dy = this.mouse[1] - head[1];
      if (dx * dx + dy * dy > 16) this.angle = Math.atan2(dy, dx);
    }
    this.boost = this.keyBoost || this.mouseBoost || this.touchBoost || padBoost;
  }
}

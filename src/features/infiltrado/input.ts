const KEY_VEC: Record<string, [number, number]> = {
  ArrowUp: [0, -1],
  KeyW: [0, -1],
  ArrowDown: [0, 1],
  KeyS: [0, 1],
  ArrowLeft: [-1, 0],
  KeyA: [-1, 0],
  ArrowRight: [1, 0],
  KeyD: [1, 0],
};

export const isTyping = (target: EventTarget | null) => target instanceof HTMLElement && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

/** Keyboard, gamepad stick and the on-screen joystick merged into one analog vector (length ≤ 1). */
export class InfInputState {
  private keys = new Set<string>();
  touch: [number, number] = [0, 0];
  /** Set while a task or meeting covers the map: the diver stands still. */
  locked = false;

  onKeyDown = (e: KeyboardEvent): void => {
    if (isTyping(e.target)) return;
    if (KEY_VEC[e.code]) {
      this.keys.add(e.code);
      e.preventDefault();
    }
  };

  onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
  };

  setTouch(x: number, y: number): void {
    this.touch = [x, y];
  }

  setLocked(locked: boolean): void {
    this.locked = locked;
  }

  reset = (): void => {
    this.keys.clear();
    this.touch = [0, 0];
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

  private pad(): [number, number] {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return [0, 0];
    const gp = [...navigator.getGamepads()].find((p) => p?.connected);
    if (!gp) return [0, 0];
    const x = gp.axes[0] ?? 0;
    const y = gp.axes[1] ?? 0;
    return Math.hypot(x, y) > 0.25 ? [x, y] : [0, 0];
  }

  sample(): [number, number] {
    if (this.locked) return [0, 0];
    let x = 0;
    let y = 0;
    for (const k of this.keys) {
      x += KEY_VEC[k][0];
      y += KEY_VEC[k][1];
    }
    if (!x && !y) [x, y] = this.touch;
    if (!x && !y) [x, y] = this.pad();
    const len = Math.hypot(x, y);
    return len > 1 ? [x / len, y / len] : [x, y];
  }
}

/** Joystick drag (px from where the finger went down) → analog vector with a dead zone. */
export function joystickVector(dx: number, dy: number, radius: number, deadZone = 8): [number, number] {
  const len = Math.hypot(dx, dy);
  if (len <= deadZone) return [0, 0];
  const k = Math.min(1, len / radius) / len;
  return [dx * k, dy * k];
}

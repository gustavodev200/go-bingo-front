import { SnakeInput } from './input';

const key = (type: 'keydown' | 'keyup', code: string) => window.dispatchEvent(new KeyboardEvent(type, { code, cancelable: true }));
function pointer(target: EventTarget, type: string, init: { x?: number; y?: number; pointerType?: string } = {}) {
  const e = new MouseEvent(type, {
    clientX: init.x ?? 0,
    clientY: init.y ?? 0,
    bubbles: true,
  });
  Object.defineProperty(e, 'pointerType', {
    value: init.pointerType ?? 'mouse',
  });
  target.dispatchEvent(e);
}

describe('SnakeInput', () => {
  let input: SnakeInput;
  let canvas: HTMLCanvasElement;
  let detach: () => void;

  beforeEach(() => {
    input = new SnakeInput();
    canvas = document.createElement('canvas');
    detach = input.attach(window, canvas);
  });
  afterEach(() => detach());

  it('follows the mouse from the head and boosts while pressed', () => {
    pointer(canvas, 'pointermove', { x: 100, y: 200 });
    pointer(canvas, 'pointerdown');
    input.update([100, 100]);
    expect(input.angle).toBeCloseTo(Math.PI / 2);
    expect(input.boost).toBe(true);
    pointer(window, 'pointerup');
    input.update([100, 100]);
    expect(input.boost).toBe(false);
  });

  it('ignores the mouse when it sits on the head and touch pointers', () => {
    input.angle = 1;
    pointer(canvas, 'pointermove', { x: 101, y: 100 });
    input.update([100, 100]);
    expect(input.angle).toBe(1);
    pointer(canvas, 'pointermove', { x: 0, y: 0, pointerType: 'touch' });
    pointer(canvas, 'pointerdown', { pointerType: 'touch' });
    input.update([100, 100]);
    expect(input.boost).toBe(false);
  });

  it('keys steer (and win over the mouse) and Space boosts', () => {
    pointer(canvas, 'pointermove', { x: 0, y: 500 });
    key('keydown', 'KeyA');
    key('keydown', 'Space');
    input.update([0, 0]);
    expect(input.angle).toBeCloseTo(Math.PI);
    expect(input.boost).toBe(true);
    key('keydown', 'ArrowUp');
    input.update([0, 0]);
    expect(input.angle).toBeCloseTo((-3 * Math.PI) / 4);
    key('keyup', 'KeyA');
    key('keyup', 'ArrowUp');
    key('keyup', 'Space');
    key('keydown', 'KeyQ');
    input.update([0, 0]);
    expect(input.boost).toBe(false);
  });

  it('typing in a text field does not steer', () => {
    const field = document.createElement('input');
    document.body.append(field);
    field.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', bubbles: true }));
    input.update([0, 0]);
    expect(input.boost).toBe(false);
    field.remove();
  });

  it('on-screen stick and boost button', () => {
    input.setTouchAngle(-1);
    input.setTouchBoost(true);
    input.update([0, 0]);
    expect(input).toMatchObject({ angle: -1, boost: true });
    input.setTouchAngle(null);
    input.setTouchBoost(false);
    input.update([0, 0]);
    expect(input).toMatchObject({ angle: -1, boost: false });
  });

  it('gamepad stick and buttons', () => {
    const pad = {
      axes: [0, 1],
      buttons: [{ pressed: false }, { pressed: false }, { pressed: false }, { pressed: false }, { pressed: false }, { pressed: true }],
    };
    input.update([0, 0], [null, pad]);
    expect(input.angle).toBeCloseTo(Math.PI / 2);
    expect(input.boost).toBe(true);
    input.update([0, 0], [{ axes: [0.1, 0], buttons: [] }]);
    expect(input.boost).toBe(false);
  });

  it('losing focus releases everything', () => {
    key('keydown', 'Space');
    input.setTouchBoost(true);
    window.dispatchEvent(new Event('blur'));
    input.update([0, 0]);
    expect(input.boost).toBe(false);
    canvas.dispatchEvent(new Event('contextmenu', { cancelable: true }));
  });
});

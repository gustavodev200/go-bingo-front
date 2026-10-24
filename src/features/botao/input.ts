import { BOTAO_DOWN, BOTAO_LEFT, BOTAO_RIGHT, BOTAO_UP, botaoDirFromVector, botaoDirVector } from '@/contracts';

const KEY_DIR: Record<string, number> = {
  ArrowUp: BOTAO_UP,
  KeyW: BOTAO_UP,
  ArrowDown: BOTAO_DOWN,
  KeyS: BOTAO_DOWN,
  ArrowLeft: BOTAO_LEFT,
  KeyA: BOTAO_LEFT,
  ArrowRight: BOTAO_RIGHT,
  KeyD: BOTAO_RIGHT,
};
const KEY_KICK = new Set(['Space', 'KeyX', 'KeyK', 'KeyJ', 'ControlLeft', 'ControlRight', 'ShiftLeft', 'ShiftRight', 'Enter', 'NumpadEnter']);

export interface TickInput {
  /** Bits de direção no espaço do campo. */
  d: number;
  /** Chute segurado. */
  k: boolean;
}

/**
 * Como o campo aparece na tela: 0 deitado (vermelho à esquerda); 1 em pé com o vermelho
 * atacando para cima; 2 em pé com o azul atacando para cima.
 */
export type Orient = 0 | 1 | 2;

/** Campo → tela. */
export function toScreen(x: number, y: number, orient: Orient): [number, number] {
  if (orient === 1) return [y, -x];
  if (orient === 2) return [-y, x];
  return [x, y];
}

/** Tela → campo (inversa de toScreen). */
export function toWorld(sx: number, sy: number, orient: Orient): [number, number] {
  if (orient === 1) return [-sy, sx];
  if (orient === 2) return [sy, -sx];
  return [sx, sy];
}

/** Direção vista na tela (teclas, joystick) convertida para o campo girado. */
export function screenBitsToWorld(bits: number, orient: Orient): number {
  if (!orient || !bits) return bits;
  const [sx, sy] = botaoDirVector(bits);
  const [wx, wy] = toWorld(sx, sy, orient);
  return botaoDirFromVector(Math.round(wx * 1000), Math.round(wy * 1000));
}

type GamepadSource = () => (Gamepad | null)[];

const isTyping = (target: EventTarget | null) => target instanceof HTMLElement && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA');

function padBits(gp: Gamepad): number {
  const pressed = (i: number) => !!gp.buttons[i]?.pressed;
  let bits = (pressed(12) ? BOTAO_UP : 0) | (pressed(13) ? BOTAO_DOWN : 0) | (pressed(14) ? BOTAO_LEFT : 0) | (pressed(15) ? BOTAO_RIGHT : 0);
  if (!bits) bits = botaoDirFromVector(gp.axes[0] ?? 0, gp.axes[1] ?? 0, 0.4);
  return bits;
}

/**
 * Teclado, controle e toque juntos num comando por tick de rede. Direções em coordenadas de tela;
 * o jogo converte para o campo conforme a orientação.
 */
export class BotaoInput {
  private keys = new Set<number>();
  private kickKeys = new Set<string>();
  /** Direção do joystick na tela (bits). */
  touchBits = 0;
  touchKick = false;

  constructor(private readonly gamepads: GamepadSource = () => (typeof navigator !== 'undefined' && navigator.getGamepads ? [...navigator.getGamepads()] : [])) {}

  setTouchBits(bits: number): void {
    this.touchBits = bits;
  }

  setTouchKick(down: boolean): void {
    this.touchKick = down;
  }

  onKeyDown = (e: KeyboardEvent): void => {
    if (isTyping(e.target)) return;
    const d = KEY_DIR[e.code];
    if (d) this.keys.add(d);
    else if (KEY_KICK.has(e.code)) this.kickKeys.add(e.code);
    else return;
    e.preventDefault();
  };

  onKeyUp = (e: KeyboardEvent): void => {
    const d = KEY_DIR[e.code];
    if (d) this.keys.delete(d);
    this.kickKeys.delete(e.code);
  };

  /** Esquece o que estava apertado (janela perdeu o foco, aba escondida). */
  reset = (): void => {
    this.keys.clear();
    this.kickKeys.clear();
    this.touchBits = 0;
    this.touchKick = false;
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

  /** Comando deste tick, já no espaço do campo. */
  sample(orient: Orient = 0): TickInput {
    const gp = this.gamepads().find((p) => p?.connected);
    let bits = 0;
    for (const k of this.keys) bits |= k;
    if (!bits) bits = this.touchBits;
    if (!bits && gp) bits = padBits(gp);
    const padKick = !!gp && [0, 1, 2, 3, 5, 7].some((i) => gp.buttons[i]?.pressed);
    return { d: screenBitsToWorld(bits, orient), k: this.kickKeys.size > 0 || this.touchKick || padKick };
  }
}

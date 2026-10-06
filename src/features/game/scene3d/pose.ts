import type { AvatarLook } from './avatar-look';
import { DOOR, slotPosition, type Vec3 } from './slots';

export type Phase = 'idle' | 'entering' | 'ready-jump' | 'ghost' | 'leaving' | 'dance' | 'winner';

export interface AvatarState {
  userId: string;
  slot: number;
  look: AvatarLook;
  phase: Phase;
  /** ms (mesmo relógio de `now`) em que a fase começou. */
  phaseStart: number;
  isHost: boolean;
  connected: boolean;
  hasCard: boolean;
  /** Até quando (ms) a cabeça fica virada para a porta (reação a quem entrou). */
  lookAtDoorUntil: number;
  /** Falta 1 pedra (destaque dourado). */
  oneAway: boolean;
}

export const PHASE_MS = { entering: 1800, 'ready-jump': 600, leaving: 2200, dance: 1500 } as const;
export const TEMPORARY_PHASES: readonly Phase[] = ['entering', 'ready-jump', 'dance'];
const WAVE_MS = 800;

export interface Pose {
  position: Vec3;
  rotationY: number;
  headYaw: number;
  scale: number;
  /** 0 = braços abaixados, 1 = braço direito erguido (aceno). */
  armRaise: number;
  /** Balanço dos braços em radianos (andar/acenar). */
  armSwing: number;
  /** 0 = cor normal, 1 = fantasma (cor pálida). */
  ghost: number;
  /** 0–1: brilho dourado ("por 1" / vencedor). */
  glow: number;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerp3 = (a: Vec3, b: Vec3, t: number): Vec3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const heading = (from: Vec3, to: Vec3) => Math.atan2(to[0] - from[0], to[2] - from[2]);

function idlePose(slot: Vec3, s: AvatarState, now: number): Pose {
  const phase = s.look.seed * Math.PI * 2;
  const breathing = 1 + 0.02 * Math.sin(now / 600 + phase);
  const lookingAtDoor = now < s.lookAtDoorUntil;
  const doorYaw = Math.max(-1.2, Math.min(1.2, heading(slot, DOOR)));
  const hop = s.oneAway ? Math.abs(Math.sin(now / 300)) * 0.12 : 0;
  return {
    position: hop ? [slot[0], slot[1] + hop, slot[2]] : slot,
    rotationY: 0,
    headYaw: lookingAtDoor ? doorYaw : 0.15 * Math.sin(now / 1700 + phase * 5),
    scale: breathing,
    armRaise: 0,
    armSwing: 0,
    ghost: 0,
    glow: s.oneAway ? 0.5 + 0.5 * Math.sin(now / 250) : 0,
  };
}

/** Pose do avatar no instante `now` (ms). Pura: mesmo estado + mesmo `now` → mesma pose, em qualquer aparelho e FPS. */
export function pose(s: AvatarState, now: number): Pose {
  const slot = slotPosition(s.slot);
  const dt = Math.max(0, now - s.phaseStart);

  switch (s.phase) {
    case 'entering': {
      const p = clamp01(dt / PHASE_MS.entering);
      const pos = lerp3(DOOR, slot, ease(p));
      const hop = Math.abs(Math.sin(p * Math.PI * 6)) * 0.15 * (1 - p);
      const travel = heading(DOOR, slot);
      return {
        position: [pos[0], pos[1] + hop, pos[2]],
        rotationY: p < 0.85 ? travel : travel * (1 - (p - 0.85) / 0.15),
        headYaw: 0,
        scale: 1,
        armRaise: 0,
        armSwing: p < 1 ? 0.6 * Math.sin(dt / 120) : 0,
        ghost: 0,
        glow: 0,
      };
    }
    case 'ready-jump': {
      const p = clamp01(dt / PHASE_MS['ready-jump']);
      const base = idlePose(slot, s, now);
      return { ...base, position: [slot[0], slot[1] + 2.4 * p * (1 - p), slot[2]], armRaise: p < 1 ? 1 : 0 };
    }
    case 'ghost':
      return {
        position: [slot[0], slot[1] + 0.15 + 0.08 * Math.sin(now / 500 + s.look.seed * 6), slot[2]],
        rotationY: 0,
        headYaw: 0,
        scale: 0.95,
        armRaise: 0,
        armSwing: 0,
        ghost: 1,
        glow: 0,
      };
    case 'leaving': {
      if (dt < WAVE_MS) {
        return { position: slot, rotationY: 0, headYaw: 0, scale: 1, armRaise: 1, armSwing: 0.5 * Math.sin((dt / WAVE_MS) * Math.PI * 4), ghost: 0, glow: 0 };
      }
      const p = clamp01((dt - WAVE_MS) / (PHASE_MS.leaving - WAVE_MS));
      return {
        position: lerp3(slot, DOOR, ease(p)),
        rotationY: heading(slot, DOOR),
        headYaw: 0,
        scale: p < 0.8 ? 1 : Math.max(0, 1 - (p - 0.8) / 0.2),
        armRaise: 0,
        armSwing: 0.6 * Math.sin(dt / 120),
        ghost: 0,
        glow: 0,
      };
    }
    case 'dance': {
      const p = clamp01(dt / PHASE_MS.dance);
      return {
        position: [slot[0], slot[1] + Math.abs(Math.sin(p * Math.PI * 2)) * 0.4, slot[2]],
        rotationY: p * 4 * Math.PI,
        headYaw: 0,
        scale: 1,
        armRaise: p < 1 ? 1 : 0,
        armSwing: 0.8 * Math.sin(dt / 90),
        ghost: 0,
        glow: 0,
      };
    }
    case 'winner':
      return {
        position: [slot[0], slot[1] + Math.abs(Math.sin(dt / 250)) * 0.5, slot[2]],
        rotationY: dt / 400,
        headYaw: 0,
        scale: 1,
        armRaise: 1,
        armSwing: 0.8 * Math.sin(dt / 90),
        ghost: 0,
        glow: 1,
      };
    case 'idle':
    default:
      return idlePose(slot, s, now);
  }
}

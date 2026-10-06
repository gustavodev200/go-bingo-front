import { avatarFromId } from './avatar-look';
import { PHASE_MS, pose, type AvatarState, type Phase } from './pose';
import { DOOR, slotPosition } from './slots';

const ID = '00000000-0000-4000-8000-000000000001';
function state(phase: Phase, phaseStart = 0, overrides: Partial<AvatarState> = {}): AvatarState {
  return { userId: ID, slot: 3, look: avatarFromId(ID), phase, phaseStart, isHost: false, connected: phase !== 'ghost', hasCard: false, lookAtDoorUntil: 0, oneAway: false, ...overrides };
}
const slot = slotPosition(3);

describe('pose', () => {
  it('entering starts at the door and ends exactly on the slot, facing the camera', () => {
    const start = pose(state('entering', 1000), 1000);
    expect(start.position[0]).toBeCloseTo(DOOR[0]);
    expect(start.position[2]).toBeCloseTo(DOOR[2]);
    const end = pose(state('entering', 1000), 1000 + PHASE_MS.entering);
    end.position.forEach((v, i) => expect(v).toBeCloseTo(slot[i]));
    expect(end.rotationY).toBeCloseTo(0);
  });

  it('entering faces the direction of travel midway', () => {
    const mid = pose(state('entering', 0), PHASE_MS.entering / 2);
    expect(mid.rotationY).toBeGreaterThan(0.3); // porta à esquerda → anda para +x
  });

  it('ready-jump peaks around 0.6 above the slot at half time and lands', () => {
    expect(pose(state('ready-jump', 0), PHASE_MS['ready-jump'] / 2).position[1]).toBeCloseTo(slot[1] + 0.6, 1);
    expect(pose(state('ready-jump', 0), PHASE_MS['ready-jump']).position[1]).toBeCloseTo(slot[1]);
  });

  it('idle stays on the slot and breathes subtly', () => {
    for (const t of [0, 333, 1234, 9999]) {
      const p = pose(state('idle'), t);
      expect(p.position[0]).toBeCloseTo(slot[0]);
      expect(p.position[2]).toBeCloseTo(slot[2]);
      expect(Math.abs(p.scale - 1)).toBeLessThanOrEqual(0.021);
    }
  });

  it('idle turns the head toward the door while someone is arriving', () => {
    const p = pose(state('idle', 0, { lookAtDoorUntil: 500 }), 100);
    expect(p.headYaw).toBeLessThan(-0.3); // porta à esquerda
    expect(Math.abs(pose(state('idle', 0, { lookAtDoorUntil: 500 }), 600).headYaw)).toBeLessThanOrEqual(0.16);
  });

  it('ghost is pale and floats above the slot', () => {
    const p = pose(state('ghost'), 777);
    expect(p.ghost).toBe(1);
    expect(p.position[1]).toBeGreaterThan(slot[1]);
  });

  it('leaving waves first, then walks to the door and shrinks away', () => {
    const waving = pose(state('leaving', 0), 300);
    expect(waving.armRaise).toBe(1);
    waving.position.forEach((v, i) => i !== 1 && expect(v).toBeCloseTo(slot[i]));
    const end = pose(state('leaving', 0), PHASE_MS.leaving);
    expect(end.position[0]).toBeCloseTo(DOOR[0]);
    expect(end.scale).toBeCloseTo(0);
  });

  it('dance spins two full turns', () => {
    expect(pose(state('dance', 0), PHASE_MS.dance).rotationY).toBeCloseTo(4 * Math.PI);
  });

  it('never produces NaN, even long after a temporary phase should have ended', () => {
    const phases: Phase[] = ['idle', 'entering', 'ready-jump', 'ghost', 'leaving', 'dance', 'winner'];
    for (const phase of phases) {
      for (const t of [-50, 0, 1, 500, 5000, 1e7]) {
        const p = pose(state(phase, 0), t);
        [...p.position, p.rotationY, p.headYaw, p.scale, p.armRaise, p.armSwing, p.ghost, p.glow].forEach((v) => expect(Number.isFinite(v)).toBe(true));
      }
    }
  });

  it('winner keeps jumping and spinning, fully glowing', () => {
    const ys = [100, 300, 500, 700].map((t) => pose(state('winner', 0), t).position[1]);
    expect(Math.max(...ys)).toBeGreaterThan(slot[1] + 0.2);
    expect(pose(state('winner', 0), 400).glow).toBe(1);
    expect(pose(state('winner', 0), 2000).rotationY).toBeGreaterThan(pose(state('winner', 0), 1000).rotationY);
  });

  it('one-away avatars glow and hop while idle; others do not', () => {
    const glows = [0, 100, 200, 300, 400].map((t) => pose(state('idle', 0, { oneAway: true }), t).glow);
    expect(Math.max(...glows)).toBeGreaterThan(0.5);
    glows.forEach((g) => expect(g).toBeLessThanOrEqual(1));
    expect(pose(state('idle', 0), 123).glow).toBe(0);
  });
});

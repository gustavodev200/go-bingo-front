import { CHARACTERS } from './characters';
import { PHASE_MS } from './pose';
import { choreograph, labelIds, statesChanged, triggerDance, type SceneMember } from './choreographer';

const A = '00000000-0000-4000-8000-00000000000a';
const B = '00000000-0000-4000-8000-00000000000b';
const C = '00000000-0000-4000-8000-00000000000c';
const D = '00000000-0000-4000-8000-00000000000d';
const m = (userId: string, slot: number, extra: Partial<SceneMember> = {}): SceneMember => ({ userId, slot, connected: true, hasCard: false, ...extra });

describe('choreograph', () => {
  it('first snapshot: everyone already in place (idle, or ghost if offline), no parade', () => {
    const s = choreograph(null, { members: [m(A, 0), m(B, 1, { connected: false })], hostId: A, now: 0 });
    expect(s.get(A)?.phase).toBe('idle');
    expect(s.get(B)?.phase).toBe('ghost');
  });

  it('dresses each player as the chosen character, and switches when it changes mid-room', () => {
    const s0 = choreograph(null, { members: [m(A, 0, { character: 'c07' }), m(B, 1)], hostId: A, now: 0 });
    expect(s0.get(A)?.look).toMatchObject(CHARACTERS.c07);
    expect(s0.get(B)?.look.body).toBeDefined();
    const s1 = choreograph(s0, { members: [m(A, 0, { character: 'c02' }), m(B, 1)], hostId: A, now: 100 });
    expect(s1.get(A)?.look).toMatchObject(CHARACTERS.c02);
    expect(s1.get(B)?.look).toBe(s0.get(B)?.look);
  });

  it('a newcomer enters, and the others look at the door', () => {
    const s0 = choreograph(null, { members: [m(A, 0)], hostId: A, now: 0 });
    const s1 = choreograph(s0, { members: [m(A, 0), m(B, 1)], hostId: A, now: 5000 });
    expect(s1.get(B)).toMatchObject({ phase: 'entering', phaseStart: 5000 });
    expect(s1.get(A)?.lookAtDoorUntil).toBe(6000);
  });

  it('entering settles into idle after its duration', () => {
    const s0 = choreograph(null, { members: [m(A, 0)], hostId: A, now: 0 });
    const s1 = choreograph(s0, { members: [m(A, 0), m(B, 1)], hostId: A, now: 100 });
    const s2 = choreograph(s1, { members: [m(A, 0), m(B, 1)], hostId: A, now: 100 + PHASE_MS.entering });
    expect(s2.get(B)?.phase).toBe('idle');
  });

  it('does not restart an animation when the same state arrives again', () => {
    const s0 = choreograph(null, { members: [m(A, 0)], hostId: A, now: 0 });
    const s1 = choreograph(s0, { members: [m(A, 0), m(B, 1)], hostId: A, now: 100 });
    const s2 = choreograph(s1, { members: [m(A, 0), m(B, 1)], hostId: A, now: 400 });
    expect(s2.get(B)).toMatchObject({ phase: 'entering', phaseStart: 100 });
  });

  it('jumps once when the player becomes ready', () => {
    const s0 = choreograph(null, { members: [m(A, 0)], hostId: A, now: 0 });
    const s1 = choreograph(s0, { members: [m(A, 0, { hasCard: true })], hostId: A, now: 50 });
    expect(s1.get(A)).toMatchObject({ phase: 'ready-jump', phaseStart: 50 });
    const s2 = choreograph(s1, { members: [m(A, 0, { hasCard: true })], hostId: A, now: 60 });
    expect(s2.get(A)?.phaseStart).toBe(50);
  });

  it('disconnect → ghost; reconnection goes idle without entering', () => {
    const s0 = choreograph(null, { members: [m(A, 0), m(B, 1)], hostId: A, now: 0 });
    const s1 = choreograph(s0, { members: [m(A, 0), m(B, 1, { connected: false })], hostId: A, now: 10 });
    expect(s1.get(B)?.phase).toBe('ghost');
    const s2 = choreograph(s1, { members: [m(A, 0), m(B, 1)], hostId: A, now: 20 });
    expect(s2.get(B)).toMatchObject({ phase: 'idle', phaseStart: 20 });
  });

  it('someone who left waves out and is removed after the animation', () => {
    const s0 = choreograph(null, { members: [m(A, 0), m(B, 1)], hostId: A, now: 0 });
    const s1 = choreograph(s0, { members: [m(A, 0)], hostId: A, now: 100 });
    expect(s1.get(B)).toMatchObject({ phase: 'leaving', phaseStart: 100 });
    const s2 = choreograph(s1, { members: [m(A, 0)], hostId: A, now: 100 + PHASE_MS.leaving - 1 });
    expect(s2.has(B)).toBe(true);
    const s3 = choreograph(s2, { members: [m(A, 0)], hostId: A, now: 100 + PHASE_MS.leaving });
    expect(s3.has(B)).toBe(false);
  });

  it('the crown follows the host', () => {
    const s0 = choreograph(null, { members: [m(A, 0), m(B, 1)], hostId: A, now: 0 });
    expect(s0.get(A)?.isHost).toBe(true);
    const s1 = choreograph(s0, { members: [m(B, 1)], hostId: B, now: 10 });
    expect(s1.get(B)?.isHost).toBe(true);
    expect(s1.get(A)?.isHost).toBe(false);
  });

  it('keeps the same look object for a returning member', () => {
    const s0 = choreograph(null, { members: [m(A, 0)], hostId: A, now: 0 });
    expect(choreograph(s0, { members: [m(A, 0)], hostId: A, now: 1 }).get(A)?.look).toBe(s0.get(A)?.look);
  });
});

describe('triggerDance', () => {
  const s0 = choreograph(null, { members: [m(A, 0), m(B, 1)], hostId: A, now: 0 });

  it('makes my own avatar dance', () => {
    expect(triggerDance(s0, A, A, 10).get(A)).toMatchObject({ phase: 'dance', phaseStart: 10 });
  });

  it("ignores taps on someone else's avatar", () => {
    expect(triggerDance(s0, B, A, 10)).toBe(s0);
  });

  it('does not interrupt an entrance or a ghost', () => {
    const s1 = choreograph(s0, { members: [m(A, 0, { connected: false }), m(B, 1)], hostId: A, now: 5 });
    expect(triggerDance(s1, A, A, 10).get(A)?.phase).toBe('ghost');
  });
});

describe('statesChanged', () => {
  it('detects membership and phase changes, ignores identical maps', () => {
    const s0 = choreograph(null, { members: [m(A, 0)], hostId: A, now: 0 });
    expect(statesChanged(null, s0)).toBe(true);
    expect(statesChanged(s0, choreograph(s0, { members: [m(A, 0)], hostId: A, now: 1 }))).toBe(false);
    expect(statesChanged(s0, choreograph(s0, { members: [m(A, 0), m(B, 1)], hostId: A, now: 1 }))).toBe(true);
    expect(statesChanged(s0, triggerDance(s0, A, A, 2))).toBe(true);
  });
});

describe('labelIds', () => {
  const crowd = choreograph(null, { members: [m(A, 0), m(B, 1), m(C, 2)], hostId: B, now: 0 });

  it('shows everyone when allowed', () => {
    expect(labelIds(crowd.values(), A, true)).toEqual(new Set([A, B, C]));
  });

  it('otherwise only me, the host and whoever is arriving', () => {
    const arriving = choreograph(crowd, { members: [m(A, 0), m(B, 1), m(C, 2), m(D, 3)], hostId: B, now: 10 });
    expect(labelIds(arriving.values(), A, false)).toEqual(new Set([A, B, D]));
  });

  it('never labels someone who is leaving', () => {
    const left = choreograph(crowd, { members: [m(A, 0), m(B, 1)], hostId: B, now: 10 });
    expect(labelIds(left.values(), A, true).has(C)).toBe(false);
  });
});

describe('one away and winner', () => {
  it('flags who is one away', () => {
    const s = choreograph(null, { members: [m(A, 0), m(B, 1)], hostId: A, now: 0, oneAway: new Set([B]) });
    expect(s.get(B)?.oneAway).toBe(true);
    expect(s.get(A)?.oneAway).toBe(false);
  });

  it('the winner celebrates until the win is cleared', () => {
    const s0 = choreograph(null, { members: [m(A, 0), m(B, 1)], hostId: A, now: 0 });
    const s1 = choreograph(s0, { members: [m(A, 0), m(B, 1)], hostId: A, now: 50, winnerId: B });
    expect(s1.get(B)).toMatchObject({ phase: 'winner', phaseStart: 50 });
    const s2 = choreograph(s1, { members: [m(A, 0), m(B, 1)], hostId: A, now: 60, winnerId: B });
    expect(s2.get(B)?.phaseStart).toBe(50);
    const s3 = choreograph(s2, { members: [m(A, 0), m(B, 1)], hostId: A, now: 70, winnerId: null });
    expect(s3.get(B)?.phase).toBe('idle');
  });

  it('a winner who already left does not create an avatar', () => {
    const s = choreograph(null, { members: [m(A, 0)], hostId: A, now: 0, winnerId: B });
    expect(s.has(B)).toBe(false);
  });

  it('statesChanged notices one-away changes', () => {
    const s0 = choreograph(null, { members: [m(A, 0)], hostId: A, now: 0 });
    expect(statesChanged(s0, choreograph(s0, { members: [m(A, 0)], hostId: A, now: 1, oneAway: new Set([A]) }))).toBe(true);
  });

  it('labels always show who is one away and the winner', () => {
    const crowd = choreograph(null, { members: [m(A, 0), m(B, 1), m(C, 2)], hostId: A, now: 0, oneAway: new Set([C]) });
    expect(labelIds(crowd.values(), A, false)).toEqual(new Set([A, C]));
    const won = choreograph(crowd, { members: [m(A, 0), m(B, 1), m(C, 2)], hostId: A, now: 5, winnerId: B });
    expect(labelIds(won.values(), A, false).has(B)).toBe(true);
  });

  it('a winner who drops keeps celebrating without restarting the animation every tick', () => {
    const s0 = choreograph(null, { members: [m(A, 0), m(B, 1)], hostId: A, now: 0 });
    const s1 = choreograph(s0, { members: [m(A, 0), m(B, 1, { connected: false })], hostId: A, now: 50, winnerId: B });
    const s2 = choreograph(s1, { members: [m(A, 0), m(B, 1, { connected: false })], hostId: A, now: 200, winnerId: B });
    expect(s2.get(B)).toMatchObject({ phase: 'winner', phaseStart: 50 });
    expect(statesChanged(s1, s2)).toBe(false);
  });
});

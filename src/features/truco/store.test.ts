import { privateHand, roomState } from '@/test/truco-fixtures';
import { useTrucoStore } from './store';

describe('useTrucoStore', () => {
  beforeEach(() => useTrucoStore.getState().reset());

  it('ignores older or repeated room states', () => {
    const s = useTrucoStore.getState();
    s.applyState(roomState({ version: 5, scores: [2, 0] }));
    s.applyState(roomState({ version: 4, scores: [0, 0] }));
    s.applyState(roomState({ version: 5, scores: [9, 9] }));
    expect(useTrucoStore.getState().state!.scores).toEqual([2, 0]);
    s.applyState(roomState({ version: 6, scores: [4, 0] }));
    expect(useTrucoStore.getState().state!.scores).toEqual([4, 0]);
  });

  it('drops duplicated announcements by sequence number', () => {
    const { accept } = useTrucoStore.getState();
    expect(accept(1)).toBe(true);
    expect(accept(1)).toBe(false);
    expect(accept(2)).toBe(true);
    expect(accept(1)).toBe(false);
  });

  it('keeps the newest private hand and clears it back in the lobby', () => {
    const s = useTrucoStore.getState();
    s.applyHand(privateHand({ handNumber: 2 }));
    s.applyHand(privateHand({ handNumber: 1, cards: [] }));
    expect(useTrucoStore.getState().hand!.cards).toHaveLength(3);
    s.applyState(roomState({ version: 9, phase: 'LOBBY', match: null }));
    expect(useTrucoStore.getState().hand).toBeNull();
  });

  it('applies a snapshot and resets the sequence for another room', () => {
    const s = useTrucoStore.getState();
    s.applyState(roomState({ code: 'ABC234' }));
    s.accept(10);
    s.applySnapshot({ state: roomState({ code: 'XYZ234' }), mySeat: 2, hand: privateHand() });
    expect(useTrucoStore.getState()).toMatchObject({ mySeat: 2, lastSeq: 0 });
    expect(useTrucoStore.getState().hand!.handNumber).toBe(1);
  });

  it('adds and removes visual effects, keeping only the latest few', () => {
    const s = useTrucoStore.getState();
    const id = s.addEffect({ kind: 'shout', text: 'TRUCO!', tone: 'bet' });
    for (let i = 0; i < 8; i++) s.addEffect({ kind: 'gesture', seat: 1, gesture: null });
    expect(useTrucoStore.getState().effects.length).toBeLessThanOrEqual(6);
    s.removeEffect(id);
    expect(useTrucoStore.getState().effects.some((e) => e.id === id)).toBe(false);
  });
});

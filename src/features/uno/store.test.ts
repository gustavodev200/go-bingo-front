import { privateHand, roomState, seatPlayer } from '@/test/uno-fixtures';
import { useUnoStore } from './store';

describe('useUnoStore', () => {
  beforeEach(() => useUnoStore.getState().reset());

  it('ignores older or repeated room states', () => {
    const s = useUnoStore.getState();
    s.applyState(roomState({ version: 5, scores: [9, 0, 0, 0, 0, 0] }));
    s.applyState(roomState({ version: 4, scores: [1, 0, 0, 0, 0, 0] }));
    expect(useUnoStore.getState().state!.scores[0]).toBe(9);
    s.applyState(roomState({ version: 6, scores: [20, 0, 0, 0, 0, 0] }));
    expect(useUnoStore.getState().state!.scores[0]).toBe(20);
  });

  it('drops a seat I lost and clears the hand back in the lobby', () => {
    const s = useUnoStore.getState();
    s.applySnapshot({ state: roomState(), mySeat: 1, hand: privateHand() });
    s.applyState(roomState({ version: 2, phase: 'LOBBY', round: null }));
    expect(useUnoStore.getState().hand).toBeNull();
    s.applyState(
      roomState({
        version: 3,
        seats: [seatPlayer(0), null, seatPlayer(2), null, null, null],
      }),
    );
    expect(useUnoStore.getState().mySeat).toBeNull();
  });

  it('keeps the newest round hand', () => {
    const s = useUnoStore.getState();
    s.applyHand(privateHand({ roundNumber: 2 }));
    s.applyHand(privateHand({ roundNumber: 1, cards: [] }));
    expect(useUnoStore.getState().hand!.roundNumber).toBe(2);
  });

  it('drops duplicated announcements by sequence number', () => {
    const { accept } = useUnoStore.getState();
    expect(accept(1)).toBe(true);
    expect(accept(1)).toBe(false);
    expect(accept(2)).toBe(true);
  });

  it('keeps only the last few effects', () => {
    const s = useUnoStore.getState();
    for (let i = 0; i < 10; i++) s.addEffect({ kind: 'shout', text: `${i}`, tone: 'info' });
    expect(useUnoStore.getState().effects.length).toBeLessThanOrEqual(6);
  });
});

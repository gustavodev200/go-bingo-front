import { privateHand, roomState, seatPlayer } from '@/test/domino-fixtures';
import { useDominoStore } from './store';

describe('useDominoStore', () => {
  beforeEach(() => useDominoStore.getState().reset());

  it('ignores older or repeated room states', () => {
    const s = useDominoStore.getState();
    s.applyState(roomState({ version: 5, scores: [9, 0, 0, 0] }));
    s.applyState(roomState({ version: 4, scores: [1, 0, 0, 0] }));
    expect(useDominoStore.getState().state!.scores[0]).toBe(9);
    s.applyState(roomState({ version: 6, scores: [20, 0, 0, 0] }));
    expect(useDominoStore.getState().state!.scores[0]).toBe(20);
  });

  it('drops a seat I lost and clears the hand back in the lobby', () => {
    const s = useDominoStore.getState();
    s.applySnapshot({ state: roomState(), mySeat: 1, hand: privateHand() });
    s.applyState(roomState({ version: 2, phase: 'LOBBY', round: null }));
    expect(useDominoStore.getState().hand).toBeNull();
    s.applyState(roomState({ version: 3, seats: [seatPlayer(0), null, seatPlayer(2), null] }));
    expect(useDominoStore.getState().mySeat).toBeNull();
  });

  it('keeps the newest round hand and drops duplicated announcements', () => {
    const s = useDominoStore.getState();
    s.applyHand(privateHand({ roundNumber: 2 }));
    s.applyHand(privateHand({ roundNumber: 1, tiles: [] }));
    expect(useDominoStore.getState().hand!.roundNumber).toBe(2);
    expect(s.accept(1)).toBe(true);
    expect(s.accept(1)).toBe(false);
  });
});

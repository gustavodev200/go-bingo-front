import { roomState, seatPlayer } from '@/test/damas-fixtures';
import { endReasonText, drawCountdown, turnLabel, winnerTitle } from './rules-view';
import { useDamasStore } from './store';

describe('useDamasStore', () => {
  beforeEach(() => useDamasStore.getState().reset());

  it('keeps the newest state and finds my seat by user id', () => {
    const s = useDamasStore.getState();
    s.applySnapshot({ state: roomState({ version: 3 }), mySeat: 1 });
    s.applyState(roomState({ version: 2, phase: 'LOBBY' }));
    expect(useDamasStore.getState().state?.phase).toBe('PLAYING');
    s.applyState(roomState({ version: 4, seats: [seatPlayer(1, { seat: 0 }), null] }));
    expect(useDamasStore.getState().mySeat).toBe(0);
  });

  it('drops repeated announcements and caps the effects', () => {
    const s = useDamasStore.getState();
    expect(s.accept(1)).toBe(true);
    expect(useDamasStore.getState().accept(1)).toBe(false);
    for (let i = 0; i < 10; i++) useDamasStore.getState().addEffect({ kind: 'banner', text: `${i}`, tone: 'info' });
    expect(useDamasStore.getState().effects.length).toBeLessThanOrEqual(6);
    const id = useDamasStore.getState().effects[0].id;
    useDamasStore.getState().removeEffect(id);
    expect(useDamasStore.getState().effects.some((e) => e.id === id)).toBe(false);
  });
});

describe('rules view', () => {
  it('labels times, winners and reasons', () => {
    expect(turnLabel(30)).toBe('30 s');
    expect(turnLabel(120)).toBe('2 min');
    expect(winnerTitle(roomState(), { winner: 0, reason: 'blocked' }, 0)).toBe('Você venceu!');
    expect(winnerTitle(roomState(), { winner: null, reason: 'draw_moves' }, 0)).toBe('Empate!');
    for (const reason of ['no_pieces', 'blocked', 'resign', 'timeout', 'abandoned', 'draw_agreed', 'draw_moves'] as const) {
      expect(endReasonText(reason, true)).toBeTruthy();
      expect(endReasonText(reason, false)).toBeTruthy();
    }
  });

  it('counts down to the king-only draw once it gets close', () => {
    expect(drawCountdown(10)).toBeNull();
    expect(drawCountdown(30)).toBe(5);
  });
});

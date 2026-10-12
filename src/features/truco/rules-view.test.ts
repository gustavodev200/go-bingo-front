import { matchView, roomState } from '@/test/truco-fixtures';
import { availableActions, nextBet, positionOf, teamLabel, visibleRound } from './rules-view';

describe('positionOf', () => {
  it('always puts me at the bottom, the next player to my right and my partner on top', () => {
    expect([0, 1, 2, 3].map((s) => positionOf(s as 0, 0))).toEqual(['bottom', 'right', 'top', 'left']);
    expect([0, 1, 2, 3].map((s) => positionOf(s as 0, 3))).toEqual(['right', 'top', 'left', 'bottom']);
  });

  it('labels teams from my point of view', () => {
    expect(teamLabel(1, 1)).toBe('Nós');
    expect(teamLabel(0, 1)).toBe('Eles');
  });
});

describe('nextBet', () => {
  it('follows 2 → 4 → 6 → 10 → 12', () => {
    expect([2, 4, 6, 10, 12, 3].map(nextBet)).toEqual([4, 6, 10, 12, null, null]);
  });
});

describe('availableActions', () => {
  it('offers play and truco on my turn', () => {
    const a = availableActions(roomState(), 0);
    expect(a).toMatchObject({ myTurn: true, canPlay: true, requestValue: 4, mustRespond: false });
  });

  it('offers nothing outside the match or when it is not my turn', () => {
    expect(availableActions(null, 0).canPlay).toBe(false);
    expect(availableActions(roomState({ phase: 'LOBBY' }), 0).requestValue).toBeNull();
    expect(availableActions(roomState(), 1)).toMatchObject({ canPlay: false, requestValue: null });
  });

  it('blocks a second raise by the same team and truco in special hands', () => {
    expect(availableActions(roomState({ match: matchView({ lastRaiseTeam: 0, value: 4 }) }), 0).requestValue).toBeNull();
    expect(availableActions(roomState({ match: matchView({ lastRaiseTeam: 1, value: 4 }) }), 0).requestValue).toBe(6);
    expect(availableActions(roomState({ match: matchView({ kind: 'iron' }) }), 0).requestValue).toBeNull();
    expect(availableActions(roomState({ match: matchView({ value: 12, lastRaiseTeam: 1 }) }), 0).requestValue).toBeNull();
  });

  it('asks the opponents to respond and the requesters to wait', () => {
    const state = roomState({ match: matchView({ phase: 'AWAITING_BET_RESPONSE', pendingBet: { value: 4, requestedBy: 0, team: 0 } }) });
    expect(availableActions(state, 1)).toMatchObject({ mustRespond: true, raiseValue: 6, waitingResponse: false });
    expect(availableActions(state, 2)).toMatchObject({ mustRespond: false, waitingResponse: true });
    const top = roomState({ match: matchView({ phase: 'AWAITING_BET_RESPONSE', pendingBet: { value: 12, requestedBy: 0, team: 0 } }) });
    expect(availableActions(top, 1).raiseValue).toBeNull();
  });

  it('tells who decides the mão de dez', () => {
    const state = roomState({ match: matchView({ phase: 'AWAITING_TEN_DECISION', kind: 'ten', tenTeam: 1 }) });
    expect(availableActions(state, 3).tenDecision).toBe('mine');
    expect(availableActions(state, 0).tenDecision).toBe('theirs');
  });
});

describe('visibleRound', () => {
  it('shows the current round, or the last finished one while the next is empty', () => {
    expect(visibleRound(null)).toBeNull();
    const played = { plays: [{ seat: 0 as const, card: { rank: '3' as const, suit: 'clubs' as const } }], result: 0 as const, winningSeat: 0 as const };
    expect(visibleRound(roomState({ match: matchView({ rounds: [played, { plays: [], result: null, winningSeat: null }] }) }))).toEqual({ round: played, number: 1 });
    expect(visibleRound(roomState())!.number).toBe(1);
  });
});

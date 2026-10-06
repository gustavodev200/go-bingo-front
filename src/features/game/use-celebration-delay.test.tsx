import { act, renderHook } from '@testing-library/react';
import { CELEBRATION_MS, useCelebrationDelay } from './use-celebration-delay';

describe('useCelebrationDelay', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('switches immediately when disabled (2D)', () => {
    const { result, rerender } = renderHook(({ inGame }) => useCelebrationDelay(inGame, false), { initialProps: { inGame: false } });
    rerender({ inGame: true });
    expect(result.current).toBe(true);
  });

  it('holds the lobby for the confetti, then switches', () => {
    const { result, rerender } = renderHook(({ inGame }) => useCelebrationDelay(inGame, true), { initialProps: { inGame: false } });
    rerender({ inGame: true });
    expect(result.current).toBe(false);
    act(() => vi.advanceTimersByTime(CELEBRATION_MS));
    expect(result.current).toBe(true);
  });

  it('does not delay when the room is already in game on arrival (reconnect)', () => {
    const { result } = renderHook(() => useCelebrationDelay(true, true));
    expect(result.current).toBe(true);
  });

  it('goes back to the lobby right away on replay', () => {
    const { result, rerender } = renderHook(({ inGame }) => useCelebrationDelay(inGame, true), { initialProps: { inGame: true } });
    rerender({ inGame: false });
    expect(result.current).toBe(false);
  });
});

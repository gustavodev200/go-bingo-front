import { act, renderHook } from '@testing-library/react';
import { useOnlineStatus } from './use-online-status';

function setOnLine(value: boolean) {
  vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(value);
}

describe('useOnlineStatus', () => {
  afterEach(() => vi.restoreAllMocks());

  it('reflects the initial state', () => {
    setOnLine(false);
    expect(renderHook(() => useOnlineStatus()).result.current).toBe(false);
  });

  it('follows online/offline events', () => {
    setOnLine(true);
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(true);
    act(() => {
      setOnLine(false);
      window.dispatchEvent(new Event('offline'));
    });
    expect(result.current).toBe(false);
    act(() => {
      setOnLine(true);
      window.dispatchEvent(new Event('online'));
    });
    expect(result.current).toBe(true);
  });
});

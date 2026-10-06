import { renderHook, waitFor } from '@testing-library/react';
import { useWakeLock } from './use-wake-lock';

function makeSentinel() {
  return { released: false, release: vi.fn(async function (this: { released: boolean }) { this.released = true; }) };
}

function installWakeLock(request: ReturnType<typeof vi.fn>) {
  Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request } });
}

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: state });
  document.dispatchEvent(new Event('visibilitychange'));
}

describe('useWakeLock', () => {
  afterEach(() => {
    Reflect.deleteProperty(navigator, 'wakeLock');
    setVisibility('visible');
  });

  it('does nothing when the API is unsupported', () => {
    expect(() => renderHook(() => useWakeLock(true))).not.toThrow();
  });

  it('does not request a lock while inactive', () => {
    const request = vi.fn();
    installWakeLock(request);
    renderHook(() => useWakeLock(false));
    expect(request).not.toHaveBeenCalled();
  });

  it('acquires while active and releases on deactivation', async () => {
    const sentinel = makeSentinel();
    const request = vi.fn(async () => sentinel);
    installWakeLock(request);
    const { rerender } = renderHook(({ active }) => useWakeLock(active), { initialProps: { active: true } });
    await waitFor(() => expect(request).toHaveBeenCalledWith('screen'));
    rerender({ active: false });
    await waitFor(() => expect(sentinel.release).toHaveBeenCalled());
  });

  it('reacquires when the tab becomes visible again after the lock was lost', async () => {
    const first = makeSentinel();
    const second = makeSentinel();
    const request = vi.fn().mockResolvedValueOnce(first).mockResolvedValueOnce(second);
    installWakeLock(request);
    renderHook(() => useWakeLock(true));
    await waitFor(() => expect(request).toHaveBeenCalledTimes(1));
    first.released = true; // o navegador solta o lock ao ocultar a aba
    setVisibility('hidden');
    setVisibility('visible');
    await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
  });

  it('keeps the game running when the request is denied', async () => {
    const request = vi.fn().mockRejectedValue(new DOMException('low battery', 'NotAllowedError'));
    installWakeLock(request);
    expect(() => renderHook(() => useWakeLock(true))).not.toThrow();
    await waitFor(() => expect(request).toHaveBeenCalled());
  });

  it('releases a lock that resolves after unmount', async () => {
    const sentinel = makeSentinel();
    let resolve!: (value: typeof sentinel) => void;
    const request = vi.fn(() => new Promise<typeof sentinel>((r) => { resolve = r; }));
    installWakeLock(request);
    const { unmount } = renderHook(() => useWakeLock(true));
    unmount();
    resolve(sentinel);
    await waitFor(() => expect(sentinel.release).toHaveBeenCalled());
  });
});

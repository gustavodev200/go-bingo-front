import { act, renderHook, waitFor } from '@testing-library/react';
import { clearDeferredInstall } from './install-event';
import { useInstallPrompt } from './use-install-prompt';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/126.0 Mobile Safari/537.36';
const INSTAGRAM_IOS = `${IPHONE} Instagram 300.0`;
const KEY = 'go-bingo:install-dismissed';

function setUa(ua: string, touchPoints = 5) {
  vi.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue(ua);
  Object.defineProperty(window.navigator, 'maxTouchPoints', { configurable: true, value: touchPoints }); // jsdom não define
}
function setStandalone(value: boolean) {
  window.matchMedia = vi.fn().mockReturnValue({ matches: value }) as unknown as typeof window.matchMedia;
}
function fireBeforeInstallPrompt(outcome: 'accepted' | 'dismissed' = 'accepted') {
  const event = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
    prompt: vi.fn(async () => undefined),
    userChoice: Promise.resolve({ outcome }),
  });
  act(() => void window.dispatchEvent(event));
  return event;
}

describe('useInstallPrompt', () => {
  beforeEach(() => {
    clearDeferredInstall();
    localStorage.clear();
    setStandalone(false);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    Reflect.deleteProperty(window.navigator, 'maxTouchPoints');
  });

  it('is hidden on Android until the browser offers the prompt', async () => {
    setUa(ANDROID);
    const { result } = renderHook(() => useInstallPrompt());
    expect(result.current.mode).toBe('hidden');
    fireBeforeInstallPrompt();
    await waitFor(() => expect(result.current.mode).toBe('prompt'));
  });

  it('captures the event (preventDefault) and prompts on install()', async () => {
    setUa(ANDROID);
    const { result } = renderHook(() => useInstallPrompt());
    const event = fireBeforeInstallPrompt('accepted');
    await waitFor(() => expect(result.current.mode).toBe('prompt'));
    expect(event.defaultPrevented).toBe(true);
    await act(() => result.current.install());
    expect(event.prompt).toHaveBeenCalled();
    expect(result.current.mode).toBe('hidden');
  });

  it('shows the iOS instructions on iPhone Safari', async () => {
    setUa(IPHONE);
    const { result } = renderHook(() => useInstallPrompt());
    await waitFor(() => expect(result.current.mode).toBe('ios'));
  });

  it('stays hidden when already installed (standalone)', () => {
    setUa(IPHONE);
    setStandalone(true);
    const { result } = renderHook(() => useInstallPrompt());
    fireBeforeInstallPrompt();
    expect(result.current.mode).toBe('hidden');
  });

  it('stays hidden inside in-app browsers (cannot install from there)', () => {
    setUa(INSTAGRAM_IOS);
    const { result } = renderHook(() => useInstallPrompt());
    fireBeforeInstallPrompt();
    expect(result.current.mode).toBe('hidden');
  });

  it('remembers dismissal across mounts', async () => {
    setUa(IPHONE);
    const first = renderHook(() => useInstallPrompt());
    await waitFor(() => expect(first.result.current.mode).toBe('ios'));
    act(() => first.result.current.dismiss());
    expect(first.result.current.mode).toBe('hidden');
    expect(localStorage.getItem(KEY)).toBe('1');
    first.unmount();
    const second = renderHook(() => useInstallPrompt());
    expect(second.result.current.mode).toBe('hidden');
  });

  it('survives blocked localStorage', async () => {
    setUa(IPHONE);
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const { result } = renderHook(() => useInstallPrompt());
    await waitFor(() => expect(result.current.mode).toBe('ios'));
    expect(() => act(() => result.current.dismiss())).not.toThrow();
    expect(result.current.mode).toBe('hidden');
  });

  it('hides after appinstalled', async () => {
    setUa(ANDROID);
    const { result } = renderHook(() => useInstallPrompt());
    fireBeforeInstallPrompt();
    await waitFor(() => expect(result.current.mode).toBe('prompt'));
    act(() => void window.dispatchEvent(new Event('appinstalled')));
    expect(result.current.mode).toBe('hidden');
  });

  it('still offers the prompt when the browser fired the event before the hook mounted', async () => {
    setUa(ANDROID);
    const event = fireBeforeInstallPrompt();
    const { result } = renderHook(() => useInstallPrompt());
    await waitFor(() => expect(result.current.mode).toBe('prompt'));
    expect(event.defaultPrevented).toBe(true);
  });

  it('keeps the captured event when the component unmounts and remounts', async () => {
    setUa(ANDROID);
    const first = renderHook(() => useInstallPrompt());
    fireBeforeInstallPrompt();
    await waitFor(() => expect(first.result.current.mode).toBe('prompt'));
    first.unmount();
    const second = renderHook(() => useInstallPrompt());
    await waitFor(() => expect(second.result.current.mode).toBe('prompt'));
  });
});

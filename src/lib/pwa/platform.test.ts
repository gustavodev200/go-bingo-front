import { isIos, isStandalone } from './platform';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1';
const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/126.0 Mobile Safari/537.36';

describe('isIos', () => {
  it('detects iPhone, and iPadOS posing as a Mac (touch screen)', () => {
    expect(isIos(IPHONE, 5)).toBe(true);
    expect(isIos(MAC, 5)).toBe(true);
  });
  it('rejects a real Mac and Android', () => {
    expect(isIos(MAC, 0)).toBe(false);
    expect(isIos(ANDROID, 5)).toBe(false);
  });
});

describe('isStandalone', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    Reflect.deleteProperty(navigator, 'standalone');
  });

  it('is true when display-mode is standalone', () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as unknown as typeof window.matchMedia;
    expect(isStandalone()).toBe(true);
  });

  it('is true for iOS navigator.standalone', () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as unknown as typeof window.matchMedia;
    Object.defineProperty(navigator, 'standalone', { configurable: true, value: true });
    expect(isStandalone()).toBe(true);
  });

  it('is false in a regular tab', () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as unknown as typeof window.matchMedia;
    expect(isStandalone()).toBe(false);
  });
});

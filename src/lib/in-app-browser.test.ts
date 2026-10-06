import { chromeIntentUrl, isInAppBrowser } from './in-app-browser';

describe('isInAppBrowser', () => {
  it.each([
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Instagram 300.0.0.0',
    'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 [FB_IAB/FB4A;FBAV/450.0.0.0;]',
    'Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 [FBAN/FBIOS;FBAV/450.0]',
    'Mozilla/5.0 (Linux; Android 14) musical_ly_2023 BytedanceWebview',
  ])('detects %s', (ua) => {
    expect(isInAppBrowser(ua)).toBe(true);
  });

  it.each([
    'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1',
  ])('ignores regular browser %s', (ua) => {
    expect(isInAppBrowser(ua)).toBe(false);
  });
});

describe('chromeIntentUrl', () => {
  it('builds an Android intent that opens Chrome', () => {
    expect(chromeIntentUrl('https://gobingo.app/ABC234?x=1')).toBe(
      'intent://gobingo.app/ABC234?x=1#Intent;scheme=https;package=com.android.chrome;end',
    );
  });
});

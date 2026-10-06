import { isCacheableAsset } from './cache-rules';

const SELF = 'https://gobingo.app';
const u = (href: string) => new URL(href);

describe('isCacheableAsset', () => {
  it('caches same-origin Next static chunks and PWA icons', () => {
    expect(isCacheableAsset(u(`${SELF}/_next/static/chunks/app.js`), SELF)).toBe(true);
    expect(isCacheableAsset(u(`${SELF}/pwa-icons/icon-192.png`), SELF)).toBe(true);
  });

  it('never caches API or third-party origins, even for matching paths', () => {
    expect(isCacheableAsset(u('http://localhost:3333/rooms'), SELF)).toBe(false);
    expect(isCacheableAsset(u('https://api.gobingo.app/ranking'), SELF)).toBe(false);
    expect(isCacheableAsset(u('https://x.supabase.co/_next/static/a.js'), SELF)).toBe(false);
  });

  it('never caches pages, RSC payloads, the service worker or auth routes', () => {
    expect(isCacheableAsset(u(`${SELF}/`), SELF)).toBe(false);
    expect(isCacheableAsset(u(`${SELF}/ABC234`), SELF)).toBe(false);
    expect(isCacheableAsset(u(`${SELF}/?_rsc=abc`), SELF)).toBe(false);
    expect(isCacheableAsset(u(`${SELF}/serwist/sw.js`), SELF)).toBe(false);
    expect(isCacheableAsset(u(`${SELF}/auth/callback?code=1`), SELF)).toBe(false);
  });
});

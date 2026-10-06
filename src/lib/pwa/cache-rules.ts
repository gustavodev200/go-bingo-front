const CACHEABLE_PREFIXES = ['/_next/static/', '/pwa-icons/'];

/** Só assets estáticos do próprio origin. API, Supabase, HTML e RSC dependem de sessão/estado e nunca entram no cache. */
export function isCacheableAsset(url: URL, selfOrigin: string): boolean {
  return url.origin === selfOrigin && CACHEABLE_PREFIXES.some((prefix) => url.pathname.startsWith(prefix));
}

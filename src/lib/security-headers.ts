interface CspOptions {
  apiUrl: string;
  supabaseUrl: string;
  sentryDsn?: string;
}

function origin(url: string): string {
  return new URL(url).origin;
}

function wsOrigin(url: string): string {
  const o = new URL(url);
  return `${o.protocol === 'https:' ? 'wss:' : 'ws:'}//${o.host}`;
}

export function buildCsp({ apiUrl, supabaseUrl, sentryDsn }: CspOptions): string {
  const sentry = sentryDsn ? [`https://${new URL(sentryDsn).host}`] : [];
  const connect = [
    "'self'",
    origin(apiUrl),
    wsOrigin(apiUrl),
    origin(supabaseUrl),
    wsOrigin(supabaseUrl),
    'https://challenges.cloudflare.com',
    // troika (drei <Text>) baixa os dados do unicode-font-resolver via fetch.
    'https://cdn.jsdelivr.net',
    ...sentry,
  ];
  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    // Next injeta scripts inline de hidratação; o worker do troika (drei <Text>) faz importScripts de uma
    // URL blob:, que é checada contra script-src (e não só worker-src).
    'script-src': ["'self'", "'unsafe-inline'", 'blob:', 'https://challenges.cloudflare.com'],
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': ["'self'", 'data:', 'blob:'],
    'font-src': ["'self'", 'data:', 'https://cdn.jsdelivr.net'],
    'connect-src': connect,
    'frame-src': ['https://challenges.cloudflare.com'],
    'worker-src': ["'self'", 'blob:'],
    'media-src': ["'self'", 'blob:', 'data:'],
    'manifest-src': ["'self'"],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
  };
  return Object.entries(directives)
    .map(([k, v]) => `${k} ${v.join(' ')}`)
    .join('; ');
}

export function securityHeaders(opts: CspOptions) {
  return [
    { key: 'Content-Security-Policy', value: buildCsp(opts) },
    { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
  ];
}

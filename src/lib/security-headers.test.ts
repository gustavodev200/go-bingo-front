import { describe, expect, it } from 'vitest';
import { buildCsp, securityHeaders } from './security-headers';

const opts = { apiUrl: 'https://api.example.com', supabaseUrl: 'https://abc.supabase.co' };

describe('buildCsp', () => {
  it('libera só as origens necessárias (API http+ws, Supabase, Turnstile) e nega o resto', () => {
    const csp = buildCsp(opts);
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain('https://api.example.com');
    expect(csp).toContain('wss://api.example.com');
    expect(csp).toContain('https://abc.supabase.co');
    expect(csp).toContain('https://challenges.cloudflare.com');
    expect(csp).not.toContain('*');
  });

  it('inclui o host do Sentry só quando há DSN', () => {
    expect(buildCsp(opts)).not.toContain('sentry.io');
    expect(buildCsp({ ...opts, sentryDsn: 'https://k@o1.ingest.sentry.io/1' })).toContain('https://o1.ingest.sentry.io');
  });

  it('permite o jsdelivr em connect-src (troika baixa dados de fontes unicode via fetch)', () => {
    const connect = buildCsp(opts).split('; ').find((d) => d.startsWith('connect-src'));
    expect(connect).toContain('https://cdn.jsdelivr.net');
  });
});

describe('buildCsp script-src', () => {
  it('permite blob: em script-src (worker do troika faz importScripts de blob) sem curinga', () => {
    const script = buildCsp(opts).split('; ').find((d) => d.startsWith('script-src'));
    expect(script).toContain('blob:');
    expect(script).not.toContain('*');
  });
});

describe('securityHeaders', () => {
  it('envia CSP, HSTS, nosniff, referrer e permissions policy', () => {
    const keys = securityHeaders(opts).map((h) => h.key);
    expect(keys).toEqual(expect.arrayContaining(['Content-Security-Policy', 'Strict-Transport-Security', 'X-Content-Type-Options', 'Referrer-Policy', 'Permissions-Policy']));
  });
});

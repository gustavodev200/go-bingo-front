import { parsePublicEnv } from './env';

const valid = {
  NEXT_PUBLIC_SUPABASE_URL: 'https://abc.supabase.co',
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_x',
  NEXT_PUBLIC_API_URL: 'http://localhost:3333',
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: 'key',
};

describe('parsePublicEnv', () => {
  it('accepts a complete env', () => {
    expect(parsePublicEnv(valid)).toEqual(valid);
  });

  it('names the missing variable', () => {
    expect(() => parsePublicEnv({ ...valid, NEXT_PUBLIC_API_URL: undefined })).toThrow(/NEXT_PUBLIC_API_URL/);
  });

  it('accepts a missing Sentry DSN and rejects an invalid one', () => {
    expect(parsePublicEnv({ ...valid, NEXT_PUBLIC_SENTRY_DSN: undefined })).toEqual(valid);
    expect(parsePublicEnv({ ...valid, NEXT_PUBLIC_SENTRY_DSN: 'https://k@o1.ingest.sentry.io/1' }).NEXT_PUBLIC_SENTRY_DSN).toBe('https://k@o1.ingest.sentry.io/1');
    expect(() => parsePublicEnv({ ...valid, NEXT_PUBLIC_SENTRY_DSN: 'nope' })).toThrow(/NEXT_PUBLIC_SENTRY_DSN/);
  });
});

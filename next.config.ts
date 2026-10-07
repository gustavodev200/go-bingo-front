import { withSentryConfig } from '@sentry/nextjs/config';
import { withSerwist } from '@serwist/turbopack';
import type { NextConfig } from 'next';
import { securityHeaders } from './src/lib/security-headers';

const nextConfig: NextConfig = {
  async headers() {
    // Em `next dev` o React/Turbopack precisam de eval e websocket de HMR, que a CSP estrita bloquearia;
    // por isso os headers de segurança só valem no build de produção.
    if (process.env.NODE_ENV !== 'production') return [];
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!apiUrl) throw new Error('NEXT_PUBLIC_API_URL is required for production builds');
    if (!supabaseUrl) throw new Error('NEXT_PUBLIC_SUPABASE_URL is required for production builds');
    return [
      {
        source: '/:path*',
        headers: securityHeaders({
          apiUrl,
          supabaseUrl,
          sentryDsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
        }),
      },
    ];
  },
};

export default withSentryConfig(withSerwist(nextConfig), {
  silent: true,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  // Sem token não há upload de source maps (CI e dev locais continuam buildando).
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
});

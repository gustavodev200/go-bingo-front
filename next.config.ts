import { withSentryConfig } from '@sentry/nextjs/config';
import { withSerwist } from '@serwist/turbopack';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {};

export default withSentryConfig(withSerwist(nextConfig), {
  silent: true,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  // Sem token não há upload de source maps (CI e dev locais continuam buildando).
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
});

import { headers } from 'next/headers';
import { LoginPanel } from '@/features/auth/login-panel';
import { safeNextPath } from '@/lib/safe-next';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const [{ next }, h] = await Promise.all([searchParams, headers()]);
  return <LoginPanel userAgent={h.get('user-agent') ?? ''} next={safeNextPath(next)} />;
}

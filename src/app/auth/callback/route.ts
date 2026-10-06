import { NextResponse } from 'next/server';
import { safeNextPath } from '@/lib/safe-next';
import { createServerSupabase } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const errorCode = searchParams.get('error_code') ?? (searchParams.get('error') ? 'oauth_error' : null);
  if (errorCode) return NextResponse.redirect(`${origin}/auth/error?code=${encodeURIComponent(errorCode)}`);

  const code = searchParams.get('code');
  const next = safeNextPath(searchParams.get('next'));
  if (code) {
    const supabase = await createServerSupabase();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }
  return NextResponse.redirect(`${origin}/auth/error?code=exchange_failed`);
}

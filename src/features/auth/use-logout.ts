'use client';

import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

/** Encerra a sessão do Supabase e volta para o login. */
export function useLogout(): () => Promise<void> {
  const router = useRouter();
  return useCallback(async () => {
    await createClient().auth.signOut();
    router.replace('/login');
  }, [router]);
}

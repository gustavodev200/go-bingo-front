'use client';

import { Turnstile } from '@marsidev/react-turnstile';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { env } from '@/lib/env';
import { createClient } from '@/lib/supabase/client';

export function GuestButton({ next }: { next: string }) {
  const router = useRouter();
  const [verifying, setVerifying] = useState(false);

  async function signIn(captchaToken: string) {
    const { error } = await createClient().auth.signInAnonymously({ options: { captchaToken } });
    if (error) {
      setVerifying(false);
      toast.error('Não foi possível entrar como convidado. Tente novamente.');
      return;
    }
    router.replace(`/nickname?next=${encodeURIComponent(next)}`);
  }

  if (verifying) {
    return <Turnstile siteKey={env.NEXT_PUBLIC_TURNSTILE_SITE_KEY} onSuccess={(token) => void signIn(token)} options={{ size: 'flexible' }} />;
  }
  return (
    <Button variant="secondary" size="lg" className="w-full" onClick={() => setVerifying(true)}>
      Jogar como convidado
    </Button>
  );
}

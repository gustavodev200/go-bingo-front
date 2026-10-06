'use client';

import { usePathname, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';

export function UpgradeButton() {
  const router = useRouter();
  const pathname = usePathname();

  async function upgrade() {
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(pathname)}`;
    const { error } = await createClient().auth.linkIdentity({ provider: 'google', options: { redirectTo } });
    if (!error) return;
    if (error.code === 'identity_already_exists') return router.push('/auth/erro?code=identity_already_exists');
    toast.error('Não foi possível vincular sua conta Google.');
  }

  return (
    <Button onClick={() => void upgrade()} className="h-11 w-full">
      Entrar com Google para salvar seus pontos
    </Button>
  );
}

/** Usado quando o Google já tem perfil: descarta o convidado e entra na conta existente. */
export function SwitchToGoogleAccount() {
  async function switchAccount() {
    const supabase = createClient();
    await supabase.auth.signOut();
    await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}/auth/callback?next=%2F` } });
  }

  return (
    <Button onClick={() => void switchAccount()} className="h-11 w-full">
      Entrar na conta Google existente
    </Button>
  );
}

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { SwitchToGoogleAccount } from '@/features/auth/upgrade-button';

const MESSAGES: Record<string, string> = {
  identity_already_exists: 'Essa conta Google já tem um perfil no Go Bingo. Você pode entrar nela — o perfil de convidado atual será descartado (convidados não têm pontos a perder).',
  exchange_failed: 'Não foi possível concluir o login. Tente novamente.',
};

export default async function AuthErrorPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const { code = '' } = await searchParams;
  return (
    <div className="mx-auto flex max-w-sm flex-col gap-4 px-4 py-10" role="alert">
      <h1 className="text-xl font-bold">Ops!</h1>
      <p>{Object.hasOwn(MESSAGES, code) ? MESSAGES[code] : 'Não foi possível entrar com Google. Tente novamente.'}</p>
      {code === 'identity_already_exists' && <SwitchToGoogleAccount />}
      <Button asChild variant="outline">
        <Link href="/">Voltar ao início</Link>
      </Button>
    </div>
  );
}

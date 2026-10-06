export const metadata = { title: 'Offline — Go Bingo' };

export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-bold">Você está offline</h1>
      <p className="text-muted-foreground">O Go Bingo precisa de conexão para jogar. Verifique sua internet e tente de novo.</p>
      {/* Navegação completa de propósito: precisa ir à rede, não ao router client-side. */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a href="/" className="bg-primary text-primary-foreground inline-flex h-11 items-center rounded-md px-6 font-medium">
        Tentar de novo
      </a>
    </main>
  );
}

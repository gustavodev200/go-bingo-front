import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { MiniGlobe } from '@/components/stage/stage';
import { CreateRoomForm } from '@/features/rooms/create-room-form';

export default function CreateRoomPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 py-5">
      {/* no celular o dock faz esse papel */}
      <Link href="/" className="hidden min-h-11 items-center gap-1 self-start md:flex text-sm text-violet-200 hover:text-white">
        <ChevronLeft aria-hidden className="size-4" />
        Voltar
      </Link>
      <header className="flex flex-col items-center gap-3 text-center">
        <MiniGlobe />
        <h1 className="font-display text-marquee text-3xl font-bold">Nova sala</h1>
        <p className="text-muted-foreground text-sm">Monte o salão e chame a galera.</p>
      </header>
      <div className="glass p-5">
        <CreateRoomForm />
      </div>
    </main>
  );
}

'use client';

import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { SignalsSettings, useConventions } from '@/features/truco/signals-settings';

export default function TrucoSignalsPage() {
  const [conventions, setConventions] = useConventions();
  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 pt-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
      <Link href="/truco" className="flex min-h-11 items-center gap-1 self-start text-sm text-violet-200 hover:text-white">
        <ChevronLeft aria-hidden className="size-4" />
        Truco Mineiro
      </Link>
      <h1 className="font-display text-marquee text-3xl font-bold">Sinais secretos</h1>
      <section className="glass p-5">
        <SignalsSettings conventions={conventions} onChange={setConventions} />
      </section>
    </main>
  );
}

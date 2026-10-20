'use client';

import { ChevronLeft, Loader2, Plus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { roomCodeSchema } from '@/contracts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ProfilePill } from '@/features/profile/profile-pill';
import { createBjTable } from './connection';
import { PublicTables } from './public-tables';
import { PlayingCard } from './playing-card';

export function BjHome() {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [isPublic, setIsPublic] = useState(true);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setCreating(true);
    setError(null);
    const res = await createBjTable(isPublic);
    if (res.ok) router.push(`/blackjack/${res.data.state.code}`);
    else {
      setError(res.error.message);
      setCreating(false);
    }
  }

  function join(e: FormEvent) {
    e.preventDefault();
    const parsed = roomCodeSchema.safeParse(code);
    if (!parsed.success) return setError('O código tem 6 letras e números');
    router.push(`/blackjack/${parsed.data}`);
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 pt-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] md:max-w-2xl">
      <Link href="/" className="hidden min-h-11 items-center gap-1 self-start text-sm text-violet-200 hover:text-white md:flex">
        <ChevronLeft aria-hidden className="size-4" />
        Jogos
      </Link>
      <header className="flex items-center justify-between gap-3">
        <h1 className="font-display text-marquee text-3xl font-bold">Blackjack</h1>
        <ProfilePill />
      </header>

      <section className="glass flex flex-col gap-4 p-5" aria-label="Jogar">
        <div>
          <h2 className="font-display text-marquee text-2xl font-bold">Todos contra o dealer</h2>
          <p className="text-muted-foreground text-sm">
            Torneio de 21 para até 5 pessoas: todo mundo começa com 1000 fichas e, no fim das rodadas, vence quem tiver mais. Sozinho, treine contra o dealer.
          </p>
        </div>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium">Quem pode entrar</legend>
          <div className="grid grid-cols-2 gap-2">
            {[
              { value: true, label: 'Pública', hint: 'Aparece na lista' },
              { value: false, label: 'Privada', hint: 'Só com o código' },
            ].map((option) => (
              <label
                key={option.label}
                className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-white/15 px-3 py-2 has-checked:border-emerald-300/70 has-checked:bg-emerald-300/10"
              >
                <input type="radio" name="bj-visibility" className="accent-emerald-400" checked={isPublic === option.value} onChange={() => setIsPublic(option.value)} />
                <span className="flex flex-col leading-tight">
                  <span className="text-sm font-semibold">{option.label}</span>
                  <span className="text-muted-foreground text-xs">{option.hint}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <Button size="lg" className="h-12 gap-2 rounded-xl text-base" disabled={creating} onClick={() => void create()}>
          {creating ? <Loader2 aria-hidden className="animate-spin" /> : <Plus aria-hidden />}
          {creating ? 'Abrindo mesa…' : 'Criar mesa'}
        </Button>
        <div aria-hidden className="flex items-center gap-3 text-xs font-semibold tracking-widest text-violet-200/60 uppercase">
          <span className="h-px flex-1 bg-white/15" />
          ou
          <span className="h-px flex-1 bg-white/15" />
        </div>
        <form onSubmit={join} className="flex flex-col gap-2" noValidate>
          <Label htmlFor="bj-code">Código da mesa</Label>
          <div className="flex gap-2">
            <Input
              id="bj-code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              maxLength={6}
              autoComplete="off"
              autoCapitalize="characters"
              placeholder="ABC123"
              aria-invalid={!!error}
              aria-describedby={error ? 'bj-error' : undefined}
              className="h-12 rounded-xl font-mono text-lg tracking-[0.3em] uppercase"
            />
            <Button type="submit" variant="secondary" className="h-12 rounded-xl px-5">
              Entrar
            </Button>
          </div>
        </form>
        {error && (
          <p id="bj-error" role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="bj-public-title">
        <h2 id="bj-public-title" className="font-display flex items-center gap-2 text-lg font-semibold">
          <span aria-hidden className="relative flex size-2.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75 motion-reduce:animate-none" />
            <span className="relative inline-flex size-2.5 rounded-full bg-emerald-500" />
          </span>
          Mesas públicas
        </h2>
        <PublicTables />
      </section>

      <section className="glass flex flex-col gap-3 p-5" aria-labelledby="bj-howto-title">
        <h2 id="bj-howto-title" className="font-display text-lg font-semibold">
          Como jogar
        </h2>
        <div aria-hidden className="flex justify-center gap-1.5">
          {(['AS', 'KH', 'TD', '7C'] as const).map((card) => (
            <PlayingCard key={card} card={card} size="sm" />
          ))}
        </div>
        <ul className="text-muted-foreground flex list-disc flex-col gap-1 pl-5 text-xs leading-relaxed">
          <li>O objetivo é chegar mais perto de 21 que o dealer, sem passar. Passou de 21, estourou e perde a aposta.</li>
          <li>Figuras e 10 valem 10, o Ás vale 1 ou 11 e as outras cartas valem o número.</li>
          <li>Ás + 10 ou figura nas duas primeiras cartas é Blackjack: paga 3 para 2 (ou 6 para 5, se a mesa escolher).</li>
          <li>Na sua vez: pedir carta, parar, dobrar (aposta em dobro e só mais uma carta) ou dividir um par em duas mãos (uma vez só; ases recebem uma carta cada).</li>
          <li>Dealer mostrando Ás? Faça seguro por metade da aposta: paga 2 para 1 se ele tiver blackjack. No sapato de 6 baralhos dá para render e recuperar metade da aposta.</li>
          <li>O dealer compra até 17 e para em todo 17. Empate devolve a aposta.</li>
        </ul>
      </section>
    </main>
  );
}

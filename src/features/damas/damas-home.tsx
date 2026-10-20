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
import { createDamasTable } from './connection';
import { PublicTables } from './public-tables';
import { PieceView } from './board';

export function DamasHome() {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [isPublic, setIsPublic] = useState(true);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setCreating(true);
    setError(null);
    const res = await createDamasTable(isPublic);
    if (res.ok) router.push(`/damas/${res.data.state.code}`);
    else {
      setError(res.error.message);
      setCreating(false);
    }
  }

  function join(e: FormEvent) {
    e.preventDefault();
    const parsed = roomCodeSchema.safeParse(code);
    if (!parsed.success) return setError('O código tem 6 letras e números');
    router.push(`/damas/${parsed.data}`);
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 pt-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] md:max-w-2xl">
      <Link href="/" className="hidden min-h-11 items-center gap-1 self-start text-sm text-violet-200 hover:text-white md:flex">
        <ChevronLeft aria-hidden className="size-4" />
        Jogos
      </Link>
      <header className="flex items-center justify-between gap-3">
        <h1 className="font-display text-marquee text-3xl font-bold">Damas</h1>
        <ProfilePill />
      </header>

      <section className="glass flex flex-col gap-4 p-5" aria-label="Jogar">
        <div>
          <h2 className="font-display text-marquee text-2xl font-bold">1 contra 1, ao vivo</h2>
          <p className="text-muted-foreground text-sm">Damas brasileiras no tabuleiro 8x8: crie uma mesa, chame alguém pelo código ou entre numa mesa pública e prove quem manda no tabuleiro.</p>
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
                className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-white/15 px-3 py-2 has-checked:border-amber-300/70 has-checked:bg-amber-300/10"
              >
                <input type="radio" name="damas-visibility" className="accent-amber-400" checked={isPublic === option.value} onChange={() => setIsPublic(option.value)} />
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
          <Label htmlFor="damas-code">Código da mesa</Label>
          <div className="flex gap-2">
            <Input
              id="damas-code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              maxLength={6}
              autoComplete="off"
              autoCapitalize="characters"
              placeholder="ABC123"
              aria-invalid={!!error}
              aria-describedby={error ? 'damas-error' : undefined}
              className="h-12 rounded-xl font-mono text-lg tracking-[0.3em] uppercase"
            />
            <Button type="submit" variant="secondary" className="h-12 rounded-xl px-5">
              Entrar
            </Button>
          </div>
        </form>
        {error && (
          <p id="damas-error" role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="damas-public-title">
        <h2 id="damas-public-title" className="font-display flex items-center gap-2 text-lg font-semibold">
          <span aria-hidden className="relative flex size-2.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75 motion-reduce:animate-none" />
            <span className="relative inline-flex size-2.5 rounded-full bg-emerald-500" />
          </span>
          Mesas públicas
        </h2>
        <PublicTables />
      </section>

      <section className="glass flex flex-col gap-3 p-5" aria-labelledby="damas-howto-title">
        <h2 id="damas-howto-title" className="font-display text-lg font-semibold">
          Como jogar
        </h2>
        <div aria-hidden className="flex justify-center gap-2">
          {(['w', 'b', 'W', 'B'] as const).map((cell) => (
            <span key={cell} className="relative size-9 [container-type:inline-size]">
              <PieceView cell={cell} className="inset-0!" />
            </span>
          ))}
        </div>
        <ul className="text-muted-foreground flex list-disc flex-col gap-1 pl-5 text-xs leading-relaxed">
          <li>12 pedras de cada lado, só nas casas escuras. As brancas saem; as cores trocam a cada revanche.</li>
          <li>A pedra anda 1 casa na diagonal, só para frente, e captura pulando a peça adversária, para frente ou para trás.</li>
          <li>Capturar é obrigatório, e vale a lei da maioria: você tem que escolher o lance que captura mais peças, saltando em sequência.</li>
          <li>Chegou na última fileira? Vira dama: anda e captura a distância, em todas as diagonais.</li>
          <li>Vence quem capturar ou bloquear todas as peças do outro. Empate por acordo ou após 20 lances de cada lado só com damas, sem captura.</li>
          <li>Cada lance tem tempo (30 s, 1 ou 2 min). Estourou 3 vezes seguidas, perde.</li>
        </ul>
      </section>
    </main>
  );
}

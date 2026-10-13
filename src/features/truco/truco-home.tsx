'use client';

import { ChevronLeft, Eye, Loader2, Plus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { MANILHAS, roomCodeSchema, TRUCO_MODES, TRUCO_RULES, type TrucoMode } from '@/contracts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ProfilePill } from '@/features/profile/profile-pill';
import { createTable } from './connection';
import { PlayingCard } from './playing-card';
import { PublicTables } from './public-tables';

export function TrucoHome() {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [isPublic, setIsPublic] = useState(true);
  const [mode, setMode] = useState<TrucoMode>('mineiro');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setCreating(true);
    setError(null);
    const res = await createTable(isPublic, mode);
    if (res.ok) router.push(`/truco/${res.data.state.code}`);
    else {
      setError(res.error.message);
      setCreating(false);
    }
  }

  function join(e: FormEvent) {
    e.preventDefault();
    const parsed = roomCodeSchema.safeParse(code);
    if (!parsed.success) return setError('O código tem 6 letras e números');
    router.push(`/truco/${parsed.data}`);
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 pt-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] md:max-w-2xl">
      <Link href="/" className="hidden min-h-11 items-center gap-1 self-start text-sm text-violet-200 hover:text-white md:flex">
        <ChevronLeft aria-hidden className="size-4" />
        Jogos
      </Link>
      <header className="flex items-center justify-between gap-3">
        <h1 className="font-display text-marquee text-3xl font-bold">Truco</h1>
        <ProfilePill />
      </header>

      <section className="glass flex flex-col gap-4 p-5" aria-label="Jogar">
        <div>
          <h2 className="font-display text-marquee text-2xl font-bold">Truco, 2 contra 2</h2>
          <p className="text-muted-foreground text-sm">Quatro jogadores de verdade, em tempo real. Crie uma mesa e chame sua dupla e os adversários.</p>
        </div>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium">Modo</legend>
          <div className="grid grid-cols-2 gap-2">
            {TRUCO_MODES.map((value) => (
              <label key={value} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-white/15 px-3 py-2 has-checked:border-amber-300/70 has-checked:bg-amber-300/10">
                <input type="radio" name="truco-mode" className="accent-amber-400" checked={mode === value} onChange={() => setMode(value)} />
                <span className="flex flex-col leading-tight">
                  <span className="text-sm font-semibold">{TRUCO_RULES[value].name}</span>
                  <span className="text-muted-foreground text-xs">Até {TRUCO_RULES[value].targetScore} tentos</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium">Quem pode entrar</legend>
          <div className="grid grid-cols-2 gap-2">
            {[
              { value: true, label: 'Pública', hint: 'Aparece na lista' },
              { value: false, label: 'Privada', hint: 'Só com o código' },
            ].map((option) => (
              <label key={option.label} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-white/15 px-3 py-2 has-checked:border-amber-300/70 has-checked:bg-amber-300/10">
                <input type="radio" name="truco-visibility" className="accent-amber-400" checked={isPublic === option.value} onChange={() => setIsPublic(option.value)} />
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
          <Label htmlFor="truco-code">Código da mesa</Label>
          <div className="flex gap-2">
            <Input
              id="truco-code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              maxLength={6}
              autoComplete="off"
              autoCapitalize="characters"
              placeholder="ABC123"
              aria-invalid={!!error}
              aria-describedby={error ? 'truco-error' : undefined}
              className="h-12 rounded-xl font-mono text-lg tracking-[0.3em] uppercase"
            />
            <Button type="submit" variant="secondary" className="h-12 rounded-xl px-5">
              Entrar
            </Button>
          </div>
        </form>
        {error && (
          <p id="truco-error" role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="public-tables-title">
        <h2 id="public-tables-title" className="font-display flex items-center gap-2 text-lg font-semibold">
          <span aria-hidden className="relative flex size-2.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75 motion-reduce:animate-none" />
            <span className="relative inline-flex size-2.5 rounded-full bg-emerald-500" />
          </span>
          Mesas públicas
        </h2>
        <PublicTables />
      </section>

      <section className="glass flex flex-col gap-3 p-5" aria-labelledby="manilhas-title">
        <h2 id="manilhas-title" className="font-display text-lg font-semibold">
          Manilhas fixas
        </h2>
        <ol className="flex justify-between gap-2">
          {MANILHAS.map((m) => (
            <li key={m.name} className="flex flex-col items-center gap-1">
              <PlayingCard card={m} size="sm" />
            </li>
          ))}
        </ol>
        <p className="text-muted-foreground text-xs leading-relaxed">Depois: 3 &gt; 2 &gt; Ás &gt; Rei &gt; Valete &gt; Dama &gt; 7 &gt; 6 &gt; 5 &gt; 4. Mão vale 1; truco 3, seis 6, nove 9 e doze 12.</p>
        <p className="text-muted-foreground text-xs leading-relaxed">
          <strong className="text-violet-100">Mineiro:</strong> partida até 12. Mão de dez vale 4 (correndo, os adversários ganham 2); no 10 a 10 é mão de ferro, com as cartas às cegas.
        </p>
        <p className="text-muted-foreground text-xs leading-relaxed">
          <strong className="text-violet-100">Goiano:</strong> partida até 15. Quem chega no 14 vê as cartas do parceiro e decide: jogando vale 3, correndo os adversários ganham só 1. No 14 a 14 não tem mão de ferro: cada um joga vendo só as próprias cartas.
        </p>
      </section>

      <Button asChild variant="ghost" className="h-11 gap-2 self-start rounded-xl text-amber-200">
        <Link href="/truco/sinais">
          <Eye aria-hidden /> Combinar sinais secretos
        </Link>
      </Button>
    </main>
  );
}

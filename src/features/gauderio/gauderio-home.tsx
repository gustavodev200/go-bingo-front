'use client';

import { ChevronLeft, ChevronRight, Loader2, Plus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { GAUD_DEFAULT_SETTINGS, GAUD_MANILHAS, roomCodeSchema, type GaudSettings, type GaudSize, type GaudTarget } from '@/contracts';
import { Avatar } from '@/components/stage/avatar';
import { Coins } from '@/components/stage/coin';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ProfilePill } from '@/features/profile/profile-pill';
import { createTable, usePublicTables } from './connection';
import { SpanishCard } from './spanish-card';
import { settingsLabel } from './view';

/** Mesas públicas com lugar livre, ao vivo. */
export function PublicTables() {
  const rooms = usePublicTables();
  if (rooms === null)
    return (
      <p aria-busy="true" className="text-muted-foreground text-sm">
        Procurando mesas…
      </p>
    );
  if (rooms.length === 0) return <p className="text-muted-foreground rounded-2xl border border-dashed border-white/15 px-4 py-6 text-center text-sm">Nenhuma mesa pública agora. Crie uma!</p>;
  return (
    <ul className="flex flex-col gap-2">
      {rooms.map((room) => (
        <li key={room.code}>
          <Link
            href={`/gauderio/${room.code}`}
            aria-label={`Entrar na mesa de ${room.hostNickname}, ${settingsLabel(room.settings)}, ${room.players} de ${room.settings.size} jogadores`}
            className="glass group flex min-h-11 items-center gap-3 rounded-2xl px-4 py-3 transition hover:-translate-y-0.5 hover:border-emerald-300/50"
          >
            <Avatar id={room.code} character={room.hostCharacter} className="w-9" />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate font-semibold">Mesa de {room.hostNickname}</span>
              <span className="text-muted-foreground truncate text-sm">
                {settingsLabel(room.settings)} · #{room.code}
              </span>
            </span>
            {room.stake > 0 && <Coins amount={room.stake} className="rounded-full bg-amber-300/15 px-2 py-0.5 text-xs text-amber-200" />}
            <span className="text-sm font-bold text-emerald-200 tabular-nums">
              {room.players}/{room.settings.size}
            </span>
            <ChevronRight aria-hidden className="size-5 text-amber-300 transition group-hover:translate-x-0.5" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Radio<T>({ name, value, current, label, hint, onPick }: { name: string; value: T; current: T; label: string; hint: string; onPick(v: T): void }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-white/15 px-3 py-2 has-checked:border-amber-300/70 has-checked:bg-amber-300/10">
      <input type="radio" name={name} className="accent-amber-400" checked={current === value} onChange={() => onPick(value)} />
      <span className="flex flex-col leading-tight">
        <span className="text-sm font-semibold">{label}</span>
        <span className="text-muted-foreground text-xs">{hint}</span>
      </span>
    </label>
  );
}

export function GauderioHome() {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [isPublic, setIsPublic] = useState(true);
  const [settings, setSettings] = useState<GaudSettings>(GAUD_DEFAULT_SETTINGS);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const patch = (p: Partial<GaudSettings>) => setSettings((s) => ({ ...s, ...p }));

  async function create() {
    setCreating(true);
    setError(null);
    const res = await createTable(isPublic, settings);
    if (res.ok) router.push(`/gauderio/${res.data.state.code}`);
    else {
      setError(res.error.message);
      setCreating(false);
    }
  }

  function join(e: FormEvent) {
    e.preventDefault();
    const parsed = roomCodeSchema.safeParse(code);
    if (!parsed.success) return setError('O código tem 6 letras e números');
    router.push(`/gauderio/${parsed.data}`);
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 pt-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] md:max-w-2xl">
      <Link href="/" className="hidden min-h-11 items-center gap-1 self-start text-sm text-violet-200 hover:text-white md:flex">
        <ChevronLeft aria-hidden className="size-4" />
        Jogos
      </Link>
      <header className="flex items-center justify-between gap-3">
        <h1 className="font-display text-marquee text-3xl font-bold">Truco Gaudério</h1>
        <ProfilePill />
      </header>

      <section className="glass flex flex-col gap-4 p-5" aria-label="Jogar">
        <div>
          <h2 className="font-display text-marquee text-2xl font-bold">Truco Gaudério / Argentino</h2>
          <p className="text-muted-foreground text-sm">Baralho espanhol, envido e flor. Mano a mano ou em duplas, ao vivo.</p>
        </div>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium">Jogadores</legend>
          <div className="grid grid-cols-2 gap-2">
            <Radio<GaudSize> name="gaud-size" value={2} current={settings.size} label="Mano a mano" hint="1 contra 1" onPick={(size) => patch({ size })} />
            <Radio<GaudSize> name="gaud-size" value={4} current={settings.size} label="Duplas" hint="2 contra 2" onPick={(size) => patch({ size })} />
          </div>
        </fieldset>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium">Partida</legend>
          <div className="grid grid-cols-2 gap-2">
            <Radio<GaudTarget> name="gaud-target" value={12} current={settings.target} label="Até 12" hint="Partida rápida" onPick={(target) => patch({ target })} />
            <Radio<GaudTarget> name="gaud-target" value={24} current={settings.target} label="Até 24" hint="Partida longa" onPick={(target) => patch({ target })} />
            <Radio name="gaud-flor" value={true} current={settings.flor} label="Com flor" hint="3 do mesmo naipe" onPick={(flor) => patch({ flor })} />
            <Radio name="gaud-flor" value={false} current={settings.flor} label="Sem flor" hint="Só envido" onPick={(flor) => patch({ flor })} />
          </div>
        </fieldset>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium">Quem pode entrar</legend>
          <div className="grid grid-cols-2 gap-2">
            <Radio name="gaud-visibility" value={true} current={isPublic} label="Pública" hint="Aparece na lista" onPick={setIsPublic} />
            <Radio name="gaud-visibility" value={false} current={isPublic} label="Privada" hint="Só com o código" onPick={setIsPublic} />
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
          <Label htmlFor="gaud-code">Código da mesa</Label>
          <div className="flex gap-2">
            <Input
              id="gaud-code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              maxLength={6}
              autoComplete="off"
              autoCapitalize="characters"
              placeholder="ABC123"
              aria-invalid={!!error}
              aria-describedby={error ? 'gaud-error' : undefined}
              className="h-12 rounded-xl font-mono text-lg tracking-[0.3em] uppercase"
            />
            <Button type="submit" variant="secondary" className="h-12 rounded-xl px-5">
              Entrar
            </Button>
          </div>
        </form>
        {error && (
          <p id="gaud-error" role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="gaud-public-title">
        <h2 id="gaud-public-title" className="font-display flex items-center gap-2 text-lg font-semibold">
          <span aria-hidden className="relative flex size-2.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75 motion-reduce:animate-none" />
            <span className="relative inline-flex size-2.5 rounded-full bg-emerald-500" />
          </span>
          Mesas públicas
        </h2>
        <PublicTables />
      </section>

      <section className="glass flex flex-col gap-3 p-5" aria-labelledby="gaud-rules-title">
        <h2 id="gaud-rules-title" className="font-display text-lg font-semibold">
          Como se joga
        </h2>
        <ol className="flex justify-between gap-2" aria-label="Manilhas, da maior para a menor">
          {GAUD_MANILHAS.map((m) => (
            <li key={m.name}>
              <SpanishCard card={m} size="sm" />
            </li>
          ))}
        </ol>
        <p className="text-muted-foreground text-xs leading-relaxed">
          Manilhas: 1 de espadas &gt; 1 de paus &gt; 7 de espadas &gt; 7 de ouros. Depois: 3 &gt; 2 &gt; 1 &gt; 12 &gt; 11 &gt; 10 &gt; 7 &gt; 6 &gt; 5 &gt; 4.
        </p>
        <p className="text-muted-foreground text-xs leading-relaxed">
          <strong className="text-violet-100">Truco:</strong> a mão vale 1; truco 2, retruco 3, vale 4. Não quero entrega o valor anterior. Ir ao baralho entrega a mão.
        </p>
        <p className="text-muted-foreground text-xs leading-relaxed">
          <strong className="text-violet-100">Envido:</strong> só na primeira rodada. Duas cartas do mesmo naipe valem 20 + a soma (figuras valem 0). Envido 2, real envido 3, falta envido o que falta
          para quem está ganhando.
        </p>
        <p className="text-muted-foreground text-xs leading-relaxed">
          <strong className="text-violet-100">Flor:</strong> três do mesmo naipe — é obrigatório cantar. Vale 3; contra-flor 6; contra-flor e o resto, a falta.
        </p>
      </section>
    </main>
  );
}

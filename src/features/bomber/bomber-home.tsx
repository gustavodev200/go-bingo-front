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
import { BomberArt } from './bomber-art';
import { createBomberRoom } from './connection';
import { PublicRooms } from './public-rooms';

const ITEMS: { icon: string; bg: string; name: string }[] = [
  { icon: '💣', bg: 'bg-blue-700', name: 'Bomba +1' },
  { icon: '🔥', bg: 'bg-red-600', name: 'Fogo +1' },
  { icon: '🛼', bg: 'bg-teal-600', name: 'Patins' },
  { icon: '🥾', bg: 'bg-purple-600', name: 'Chute' },
  { icon: '🧤', bg: 'bg-orange-600', name: 'Luva (B)' },
  { icon: '📡', bg: 'bg-green-600', name: 'Remoto (B)' },
  { icon: '💥', bg: 'bg-amber-500', name: 'Fogo máx.' },
  { icon: '💀', bg: 'bg-red-800', name: 'Caveira' },
];

export function BomberHome() {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [isPublic, setIsPublic] = useState(true);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setCreating(true);
    setError(null);
    const res = await createBomberRoom(isPublic);
    if (res.ok) router.push(`/bomber/${res.data.state.code}`);
    else {
      setError(res.error.message);
      setCreating(false);
    }
  }

  function join(e: FormEvent) {
    e.preventDefault();
    const parsed = roomCodeSchema.safeParse(code);
    if (!parsed.success) return setError('O código tem 6 letras e números');
    router.push(`/bomber/${parsed.data}`);
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 pt-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] md:max-w-2xl">
      <Link href="/" className="hidden min-h-11 items-center gap-1 self-start text-sm text-violet-200 hover:text-white md:flex">
        <ChevronLeft aria-hidden className="size-4" />
        Jogos
      </Link>
      <header className="flex items-center justify-between gap-3">
        <h1 className="font-display text-marquee text-3xl font-bold">Bomberman</h1>
        <ProfilePill />
      </header>

      <section className="glass flex flex-col gap-4 overflow-hidden p-0" aria-label="Jogar">
        <div className="h-36">
          <BomberArt />
        </div>
        <div className="flex flex-col gap-4 px-5 pb-5">
          <div>
            <h2 className="font-display text-marquee text-2xl font-bold">Batalha de 2 a 8, ao vivo</h2>
            <p className="text-muted-foreground text-sm">Solte bombas, quebre blocos, pegue itens e seja o último de pé. Faltou gente? Chame a CPU.</p>
          </div>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium">Quem pode entrar</legend>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: true, label: 'Pública', hint: 'Aparece na lista' },
                { value: false, label: 'Privada', hint: 'Só com o código' },
              ].map((option) => (
                <label key={option.label} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-white/15 px-3 py-2 has-checked:border-amber-300/70 has-checked:bg-amber-300/10">
                  <input type="radio" name="bomber-visibility" className="accent-amber-400" checked={isPublic === option.value} onChange={() => setIsPublic(option.value)} />
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
            {creating ? 'Abrindo sala…' : 'Criar sala'}
          </Button>
          <div aria-hidden className="flex items-center gap-3 text-xs font-semibold tracking-widest text-violet-200/60 uppercase">
            <span className="h-px flex-1 bg-white/15" />
            ou
            <span className="h-px flex-1 bg-white/15" />
          </div>
          <form onSubmit={join} className="flex flex-col gap-2" noValidate>
            <Label htmlFor="bomber-code">Código da sala</Label>
            <div className="flex gap-2">
              <Input
                id="bomber-code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                maxLength={6}
                autoComplete="off"
                autoCapitalize="characters"
                placeholder="ABC123"
                aria-invalid={!!error}
                aria-describedby={error ? 'bomber-error' : undefined}
                className="h-12 rounded-xl font-mono text-lg tracking-[0.3em] uppercase"
              />
              <Button type="submit" variant="secondary" className="h-12 rounded-xl px-5">
                Entrar
              </Button>
            </div>
          </form>
          {error && (
            <p id="bomber-error" role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}
        </div>
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="bomber-public-title">
        <h2 id="bomber-public-title" className="font-display flex items-center gap-2 text-lg font-semibold">
          <span aria-hidden className="relative flex size-2.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75 motion-reduce:animate-none" />
            <span className="relative inline-flex size-2.5 rounded-full bg-emerald-500" />
          </span>
          Salas públicas
        </h2>
        <PublicRooms />
      </section>

      <section className="glass flex flex-col gap-3 p-5" aria-labelledby="bomber-howto-title">
        <h2 id="bomber-howto-title" className="font-display text-lg font-semibold">
          Como jogar
        </h2>
        <ul className="text-muted-foreground flex list-disc flex-col gap-1 pl-5 text-xs leading-relaxed">
          <li>
            <b className="text-white">Computador:</b> setas ou WASD movem, Espaço solta a bomba, K ou Shift usa a luva/remoto. Controle (gamepad) também funciona.
          </li>
          <li>
            <b className="text-white">Celular:</b> arraste no lado esquerdo para andar; 💣 solta a bomba e <b className="text-white">B</b> usa a luva/remoto.
          </li>
          <li>A explosão sai em cruz, pega quem estiver no caminho (você também!) e detona outras bombas.</li>
          <li>Com 0:50 no relógio começa a morte súbita: blocos caem do céu fechando a arena.</li>
          <li>Último de pé vence a rodada. O anfitrião escolhe quantas vitórias levam o título.</li>
        </ul>
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Itens">
          {ITEMS.map((item) => (
            <li key={item.name} className="flex items-center gap-2 text-xs font-semibold">
              <span aria-hidden className={`grid size-7 place-items-center rounded-md border-2 border-black/70 ${item.bg}`}>
                {item.icon}
              </span>
              {item.name}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

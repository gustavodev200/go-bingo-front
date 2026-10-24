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
import { BotaoArt } from './botao-art';
import { createBotaoRoom } from './connection';
import { PublicRooms } from './public-rooms';

export function BotaoHome() {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [isPublic, setIsPublic] = useState(true);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setCreating(true);
    setError(null);
    const res = await createBotaoRoom(isPublic);
    if (res.ok) router.push(`/botao/${res.data.state.code}`);
    else {
      setError(res.error.message);
      setCreating(false);
    }
  }

  function join(e: FormEvent) {
    e.preventDefault();
    const parsed = roomCodeSchema.safeParse(code);
    if (!parsed.success) return setError('O código tem 6 letras e números');
    router.push(`/botao/${parsed.data}`);
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 pt-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] md:max-w-2xl">
      <Link href="/" className="hidden min-h-11 items-center gap-1 self-start text-sm text-violet-200 hover:text-white md:flex">
        <ChevronLeft aria-hidden className="size-4" />
        Jogos
      </Link>
      <header className="flex items-center justify-between gap-3">
        <h1 className="font-display text-marquee text-3xl font-bold">Futebol de Botão</h1>
        <ProfilePill />
      </header>

      <section className="glass flex flex-col gap-4 overflow-hidden p-0" aria-label="Jogar">
        <div className="h-36">
          <BotaoArt />
        </div>
        <div className="flex flex-col gap-4 px-5 pb-5">
          <div>
            <h2 className="font-display text-marquee text-2xl font-bold">Até 4 contra 4, ao vivo</h2>
            <p className="text-muted-foreground text-sm">Vermelho contra azul: corra, dispute a bola, toque de lado e solte a bomba no ângulo. Faltou gente? Chame a CPU.</p>
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
                  <input type="radio" name="botao-visibility" className="accent-emerald-400" checked={isPublic === option.value} onChange={() => setIsPublic(option.value)} />
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
            <Label htmlFor="botao-code">Código da sala</Label>
            <div className="flex gap-2">
              <Input
                id="botao-code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                maxLength={6}
                autoComplete="off"
                autoCapitalize="characters"
                placeholder="ABC123"
                aria-invalid={!!error}
                aria-describedby={error ? 'botao-error' : undefined}
                className="h-12 rounded-xl font-mono text-lg tracking-[0.3em] uppercase"
              />
              <Button type="submit" variant="secondary" className="h-12 rounded-xl px-5">
                Entrar
              </Button>
            </div>
          </form>
          {error && (
            <p id="botao-error" role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}
        </div>
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="botao-public-title">
        <h2 id="botao-public-title" className="font-display flex items-center gap-2 text-lg font-semibold">
          <span aria-hidden className="relative flex size-2.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75 motion-reduce:animate-none" />
            <span className="relative inline-flex size-2.5 rounded-full bg-emerald-500" />
          </span>
          Salas públicas
        </h2>
        <PublicRooms />
      </section>

      <section className="glass flex flex-col gap-3 p-5" aria-labelledby="botao-howto-title">
        <h2 id="botao-howto-title" className="font-display text-lg font-semibold">
          Como jogar
        </h2>
        <ul className="text-muted-foreground flex list-disc flex-col gap-1 pl-5 text-xs leading-relaxed">
          <li>
            <b className="text-white">Computador:</b> setas ou WASD movem; segure Espaço (ou X) para chutar quando a bola encostar. Controle (gamepad) também funciona.
          </li>
          <li>
            <b className="text-white">Celular:</b> arraste no lado esquerdo para correr e segure o botão ⚽ para chutar. Em pé, o campo gira e você sempre ataca para cima.
          </li>
          <li>Segurando o chute você corre um pouco mais devagar: o contorno branco mostra que o chute está armado.</li>
          <li>Depois de cada gol a bola volta ao meio e quem sofreu dá a saída. Na saída, cada time fica no seu campo.</li>
          <li>O anfitrião escolhe o tempo e o limite de gols. Empate no fim do tempo vira gol de ouro.</li>
        </ul>
      </section>
    </main>
  );
}

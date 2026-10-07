'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Avatar } from '@/components/stage/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { isNicknameAllowed, nicknameSchema, profileSchema } from '@/contracts';
import { ApiError, apiFetch } from '@/lib/api';

const PREVIEW_LOOK = { body: '#3b82f6', accent: '#fde047', hat: 'party', face: 'grin', seed: 0, skin: '#f5c6a0', hair: '#4a2c12', hairStyle: 'spiky', pants: '#1e293b' } as const;

export function NicknameForm({ next, suggestion }: { next: string; suggestion: string }) {
  const router = useRouter();
  const [value, setValue] = useState(suggestion);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const parsed = nicknameSchema.safeParse(value);
    if (!parsed.success) return setError(parsed.error.issues[0].message);
    if (!isNicknameAllowed(parsed.data)) return setError('Apelido não permitido');
    setSaving(true);
    try {
      await apiFetch('/me', profileSchema, { method: 'PATCH', body: JSON.stringify({ nickname: parsed.data }) });
      router.replace(next);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao salvar o apelido');
      setSaving(false);
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-6 px-4 py-10">
      <header className="flex flex-col items-center gap-2 text-center">
        <p className="text-xs font-semibold tracking-[0.3em] text-pink-300 uppercase">Bem-vindo ao salão</p>
        <h1 className="font-display text-marquee text-3xl font-bold">Como quer ser chamado?</h1>
        <p className="text-muted-foreground text-sm">Os outros jogadores só veem o seu apelido.</p>
      </header>

      {/* Prévia: como o apelido aparece em cima do boneco no palco 3D. */}
      <div aria-hidden className="relative flex flex-col items-center pt-2">
        <div className="absolute -top-6 h-40 w-40 bg-[radial-gradient(ellipse_at_top,rgb(253_230_138/0.35),transparent_70%)] [clip-path:polygon(40%_0,60%_0,100%_100%,0_100%)]" />
        <span className="font-display relative max-w-full truncate px-2 text-xl font-bold text-yellow-300 [-webkit-text-stroke:1px_#1e1b4b] [paint-order:stroke_fill]">
          {value.trim() || '???'}
        </span>
        <Avatar look={PREVIEW_LOOK} className="relative w-16" />
        <span className="-mt-1 h-2 w-16 rounded-[50%] bg-black/40 blur-[2px]" />
      </div>

      <div className="glass flex flex-col gap-3 p-5">
        <Label htmlFor="nickname">Apelido</Label>
        <Input id="nickname" value={value} maxLength={16} autoComplete="nickname" className="h-12 text-lg font-semibold" onChange={(e) => setValue(e.target.value)} />
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" className="mt-1 h-12 rounded-xl text-base" disabled={saving}>
          Continuar
        </Button>
      </div>
    </form>
  );
}

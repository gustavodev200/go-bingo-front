'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { profileSchema, type CharacterId } from '@/contracts';
import { CharacterPicker } from '@/features/profile/character-picker';
import { ApiError, apiFetch } from '@/lib/api';
import { validateNickname } from '@/lib/nickname';

export function NicknameForm({ next, suggestion }: { next: string; suggestion: string }) {
  const router = useRouter();
  const [value, setValue] = useState(suggestion);
  const [character, setCharacter] = useState<CharacterId>('c01');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const check = validateNickname(value);
    if (!check.ok) return setError(check.error);
    setSaving(true);
    try {
      await apiFetch('/me', profileSchema, { method: 'PATCH', body: JSON.stringify({ nickname: check.value, character }) });
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
        <h1 className="font-display text-marquee text-3xl font-bold">Escolha seu boneco</h1>
        <p className="text-muted-foreground text-sm">Passe pelas setas e dê um nome a ele. Dá para trocar depois no perfil.</p>
      </header>

      {/* Prévia: o boneco do palco 3D com o apelido em cima, como os outros vão ver. */}
      <CharacterPicker value={character} onChange={setCharacter} label={value.trim()} />

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

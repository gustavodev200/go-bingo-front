'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { isNicknameAllowed, nicknameSchema, profileSchema } from '@/contracts';
import { ApiError, apiFetch } from '@/lib/api';

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
    <form onSubmit={(e) => void submit(e)} className="mx-auto flex w-full max-w-sm flex-col gap-3 px-4 py-10">
      <h1 className="text-2xl font-bold">Como quer ser chamado?</h1>
      <p className="text-muted-foreground text-sm">Os outros jogadores só veem o seu apelido.</p>
      <Label htmlFor="nickname">Apelido</Label>
      <Input id="nickname" value={value} maxLength={16} autoComplete="nickname" onChange={(e) => setValue(e.target.value)} />
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" disabled={saving}>
        Continuar
      </Button>
    </form>
  );
}

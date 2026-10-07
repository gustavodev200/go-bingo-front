'use client';

import { Pencil } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { profileSchema } from '@/contracts';
import { ApiError, apiFetch } from '@/lib/api';
import { validateNickname } from '@/lib/nickname';

/** Apelido com edição no lugar; `onSaved` recarrega o perfil do contexto. */
export function NicknameEditor({ nickname, onSaved }: { nickname: string; onSaved: () => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(nickname);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function open() {
    setValue(nickname);
    setError(null);
    setEditing(true);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const check = validateNickname(value);
    if (!check.ok) return setError(check.error);
    if (check.value === nickname) return setEditing(false);
    setSaving(true);
    try {
      await apiFetch('/me', profileSchema, { method: 'PATCH', body: JSON.stringify({ nickname: check.value }) });
      await onSaved();
      toast.success('Apelido atualizado!');
      setEditing(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao salvar o apelido');
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <div className="flex min-w-0 items-center justify-center gap-1">
        <h2 className="font-display truncate text-2xl font-bold text-amber-200">{nickname}</h2>
        <Button variant="ghost" size="icon" className="size-11 shrink-0 text-violet-200" aria-label="Editar apelido" onClick={open}>
          <Pencil aria-hidden />
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="flex w-full flex-col gap-2">
      <Label htmlFor="profile-nickname">Apelido</Label>
      <Input id="profile-nickname" value={value} maxLength={16} autoComplete="nickname" autoFocus className="h-12 text-lg font-semibold" onChange={(e) => setValue(e.target.value)} />
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="button" variant="outline" className="h-11 flex-1 rounded-xl" onClick={() => setEditing(false)} disabled={saving}>
          Cancelar
        </Button>
        <Button type="submit" className="h-11 flex-1 rounded-xl" disabled={saving}>
          Salvar
        </Button>
      </div>
    </form>
  );
}

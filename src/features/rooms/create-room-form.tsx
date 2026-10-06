'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createRoomResponseSchema, createRoomSchema } from '@/contracts';
import { ApiError, apiFetch } from '@/lib/api';

export function CreateRoomForm() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [maxPlayers, setMaxPlayers] = useState('15');
  const [isPublic, setIsPublic] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const parsed = createRoomSchema.safeParse({ name, maxPlayers: Number(maxPlayers), isPublic });
    if (!parsed.success) return setError(parsed.error.issues[0].message);
    setSaving(true);
    try {
      const { code } = await apiFetch('/rooms', createRoomResponseSchema, { method: 'POST', body: JSON.stringify(parsed.data) });
      router.push(`/${code}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao criar a sala');
      setSaving(false);
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-3">
      <Label htmlFor="room-name">Nome da sala</Label>
      <Input id="room-name" value={name} maxLength={24} className="h-11" onChange={(e) => setName(e.target.value)} />

      <Label htmlFor="max-players">Máximo de jogadores</Label>
      <select id="max-players" value={maxPlayers} onChange={(e) => setMaxPlayers(e.target.value)} className="border-input h-11 rounded-md border bg-transparent px-3">
        <option value="10">10</option>
        <option value="15">15</option>
        <option value="25">25</option>
      </select>

      <fieldset className="flex gap-4">
        <legend className="mb-1 text-sm font-medium">Visibilidade</legend>
        <label className="flex min-h-11 items-center gap-2">
          <input type="radio" name="visibility" checked={isPublic} onChange={() => setIsPublic(true)} /> Pública
        </label>
        <label className="flex min-h-11 items-center gap-2">
          <input type="radio" name="visibility" checked={!isPublic} onChange={() => setIsPublic(false)} /> Privada
        </label>
      </fieldset>

      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" className="h-11" disabled={saving}>
        Criar sala
      </Button>
    </form>
  );
}

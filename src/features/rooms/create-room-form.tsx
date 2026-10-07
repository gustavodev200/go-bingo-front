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
      <Input id="room-name" value={name} maxLength={24} placeholder="Ex.: Bingo da família" className="h-12 rounded-xl text-base" onChange={(e) => setName(e.target.value)} />

      <Label htmlFor="max-players" className="mt-1">
        Máximo de jogadores
      </Label>
      <select
        id="max-players"
        value={maxPlayers}
        onChange={(e) => setMaxPlayers(e.target.value)}
        className="border-input h-12 rounded-xl border bg-white/5 px-3 text-base [&>option]:bg-violet-950"
      >
        <option value="10">10</option>
        <option value="15">15</option>
        <option value="25">25</option>
      </select>

      <fieldset className="mt-1 grid grid-cols-2 gap-2">
        <legend className="mb-2 text-sm font-medium">Visibilidade</legend>
        {[
          { value: true, label: 'Pública', hint: 'aparece na lista' },
          { value: false, label: 'Privada', hint: 'só com o código' },
        ].map((option) => (
          <label
            key={option.label}
            className="flex min-h-11 cursor-pointer flex-col rounded-xl border border-white/15 bg-white/5 px-3 py-2 transition has-checked:border-amber-300 has-checked:bg-amber-300/15 has-checked:shadow-[0_0_20px_-6px_rgb(251_191_36/0.7)] has-focus-visible:ring-3 has-focus-visible:ring-ring/50"
          >
            <span className="flex items-center gap-2 font-semibold">
              <input type="radio" name="visibility" className="accent-amber-400" checked={isPublic === option.value} onChange={() => setIsPublic(option.value)} /> {option.label}
            </span>
            <span className="text-muted-foreground text-xs">{option.hint}</span>
          </label>
        ))}
      </fieldset>

      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" className="mt-2 h-12 rounded-xl text-base" disabled={saving}>
        Criar sala
      </Button>
    </form>
  );
}

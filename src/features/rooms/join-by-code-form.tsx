'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { roomCodeSchema } from '@/contracts';

export function JoinByCodeForm() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  function submit(e: FormEvent) {
    e.preventDefault();
    const parsed = roomCodeSchema.safeParse(code);
    if (!parsed.success) return setError('Código inválido');
    router.push(`/${parsed.data}`);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <Label htmlFor="room-code">Código da sala</Label>
      <div className="flex gap-2">
        <Input
          id="room-code"
          value={code}
          maxLength={8}
          autoCapitalize="characters"
          autoComplete="off"
          placeholder="ABC234"
          className="h-12 rounded-xl border-dashed border-amber-300/40 text-center font-mono text-xl font-bold tracking-[0.3em] text-amber-200 uppercase placeholder:text-white/20 md:text-xl"
          onChange={(e) => setCode(e.target.value)}
        />
        <Button type="submit" className="h-12 rounded-xl px-5 text-base">
          Entrar
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
    </form>
  );
}

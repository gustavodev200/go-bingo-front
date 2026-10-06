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
        <Input id="room-code" value={code} maxLength={8} autoCapitalize="characters" autoComplete="off" className="h-11 uppercase" onChange={(e) => setCode(e.target.value)} />
        <Button type="submit" className="h-11 px-5">
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

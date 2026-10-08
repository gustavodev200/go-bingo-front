'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { profileSchema, type CharacterId } from '@/contracts';
import { ApiError, apiFetch } from '@/lib/api';
import { CharacterPicker } from './character-picker';

/** Troca de personagem no perfil: passa pelas setas e salva; `onSaved` recarrega o perfil do contexto. */
export function CharacterEditor({ saved, onSaved }: { saved: CharacterId | null; onSaved: () => Promise<void> }) {
  const [value, setValue] = useState<CharacterId>(saved ?? 'c01');
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await apiFetch('/me', profileSchema, { method: 'PATCH', body: JSON.stringify({ character: value }) });
      await onSaved();
      toast.success('Personagem salvo!');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Erro ao salvar o personagem');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex w-full flex-col items-center gap-2">
      <CharacterPicker value={value} onChange={setValue} />
      {value !== saved && (
        <Button type="button" className="h-11 rounded-xl px-6" disabled={saving} onClick={() => void save()}>
          Salvar personagem
        </Button>
      )}
    </div>
  );
}

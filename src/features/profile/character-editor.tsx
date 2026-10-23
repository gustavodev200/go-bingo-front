'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { profileSchema, type CharacterId } from '@/contracts';
import { DEFAULT_CHARACTER } from '@/features/game/scene3d/characters';
import { ApiError, apiFetch } from '@/lib/api';
import { CharacterPicker } from './character-picker';

/** Troca de jogador no perfil (rosto, camisa, número) e salva; `onSaved` recarrega o perfil do contexto. `name` vai nas costas. */
export function CharacterEditor({ saved, name, onSaved }: { saved: CharacterId | null; name?: string | null; onSaved: () => Promise<void> }) {
  const [value, setValue] = useState<CharacterId>(saved ?? DEFAULT_CHARACTER);
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
      <CharacterPicker value={value} onChange={setValue} name={name ?? ''} />
      {value !== saved && (
        <Button type="button" className="h-11 rounded-xl px-6" disabled={saving} onClick={() => void save()}>
          Salvar personagem
        </Button>
      )}
    </div>
  );
}

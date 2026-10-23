'use client';

import { ChevronLeft, ChevronRight, RotateCcw, Search, Undo2 } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useState, type KeyboardEvent } from 'react';
import { Avatar, jerseyBackground } from '@/components/stage/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CHARACTER_FACES, MAX_BACK_NUMBER, encodeCharacter, parseCharacter, type CharacterId } from '@/contracts';
import { FACES } from '@/features/game/scene3d/avatar-look';
import { DEFAULT_CHARACTER, lookFor, stepFace } from '@/features/game/scene3d/characters';
import { JERSEY_CATEGORIES, searchJerseys, type JerseyCategory } from '@/features/game/scene3d/jerseys';
import { cn } from '@/lib/utils';

// three.js só baixa em quem abre o seletor (apelido/perfil); Home, /create e ranking continuam sem ele.
const CharacterStage = dynamic(() => import('@/features/game/scene3d/character-stage'), {
  ssr: false,
  loading: () => <span aria-hidden className="size-28 animate-pulse rounded-full bg-violet-300/10" />,
});

const ARROW = 'absolute top-1/2 size-12 -translate-y-1/2 rounded-full bg-violet-950/50 text-amber-200 ring-1 ring-white/15 backdrop-blur-sm';
const PREVIEW_ID = 'character-preview';

/**
 * Seletor do jogador: boneco 3D no meio (arraste para girar), setas ← → trocam o rosto (também teclado), catálogo de
 * camisas por categoria ou busca, número das costas, ver costas e voltar ao padrão. Tudo vira um código curto
 * (`parseCharacter`) — é só isso que vai para o perfil e para as salas.
 */
export function CharacterPicker({ value, onChange, label, name }: { value: CharacterId; onChange: (code: CharacterId) => void; label?: string; name?: string }) {
  /** Nome nas costas: o apelido (o rótulo em cima, no primeiro acesso). */
  const backName = name ?? label ?? '';
  const config = parseCharacter(value) ?? parseCharacter(DEFAULT_CHARACTER)!;
  const [category, setCategory] = useState<JerseyCategory>(() => lookFor(PREVIEW_ID, value).jersey.category);
  const [query, setQuery] = useState('');
  const [facing, setFacing] = useState<'front' | 'back'>('front');
  const face = FACES[config.face];
  const faceIndex = CHARACTER_FACES.indexOf(config.face);
  const jerseys = searchJerseys(query, category);

  function onKeyDown(e: KeyboardEvent) {
    if (e.target !== e.currentTarget) return;
    if (e.key === 'ArrowLeft') onChange(stepFace(value, -1));
    else if (e.key === 'ArrowRight') onChange(stepFace(value, 1));
    else return;
    e.preventDefault();
  }

  return (
    // w-full: dentro de um pai `items-center` (perfil) o seletor encolheria até o conteúdo e o palco 3D sumiria.
    <div role="group" aria-label="Escolha seu personagem" tabIndex={0} onKeyDown={onKeyDown} className="flex w-full flex-col items-center gap-3 rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-amber-300/70">
      {label !== undefined && (
        <span aria-hidden className="font-display max-w-full truncate px-2 text-xl font-bold text-yellow-300 [-webkit-text-stroke:1px_#1e1b4b] [paint-order:stroke_fill]">
          {label || '???'}
        </span>
      )}
      {/* Palco com a largura toda; as setas ficam por cima, nas laterais (no celular não roubam espaço do boneco). */}
      <div className="relative h-64 w-full">
        {/* holofote atrás do boneco */}
        <div aria-hidden className="absolute inset-x-10 top-0 bottom-4 bg-[radial-gradient(ellipse_at_center,rgb(253_230_138/0.22),transparent_65%)]" />
        <div className="absolute inset-0">
          <CharacterStage character={value} name={backName} facing={facing} fallback={<Avatar look={lookFor(PREVIEW_ID, value, backName)} className="mx-auto mt-10 w-24" />} />
        </div>
        <Button type="button" variant="ghost" size="icon" className={`${ARROW} left-0`} aria-label="Rosto anterior" onClick={() => onChange(stepFace(value, -1))}>
          <ChevronLeft aria-hidden className="size-7" />
        </Button>
        <Button type="button" variant="ghost" size="icon" className={`${ARROW} right-0`} aria-label="Próximo rosto" onClick={() => onChange(stepFace(value, 1))}>
          <ChevronRight aria-hidden className="size-7" />
        </Button>
      </div>

      <div className="flex w-full items-center justify-between gap-2 px-1">
        <p aria-live="polite" className="text-sm font-bold text-amber-200">
          {face.name} <span className="text-xs font-semibold text-violet-200/70 tabular-nums">· rosto {faceIndex + 1} de {CHARACTER_FACES.length}</span>
        </p>
        <div className="flex gap-1">
          <Button type="button" variant="ghost" size="sm" className="h-9 rounded-lg px-2 text-xs" onClick={() => setFacing((f) => (f === 'front' ? 'back' : 'front'))}>
            <RotateCcw aria-hidden className="size-4" />
            {facing === 'front' ? 'Ver costas' : 'Ver frente'}
          </Button>
          <Button type="button" variant="ghost" size="sm" className="h-9 rounded-lg px-2 text-xs" onClick={() => onChange(DEFAULT_CHARACTER)} disabled={value === DEFAULT_CHARACTER}>
            <Undo2 aria-hidden className="size-4" />
            Padrão
          </Button>
        </div>
      </div>

      <fieldset className="glass flex w-full flex-col gap-2 p-3">
        <legend className="sr-only">Camisa</legend>
        <div className="relative">
          <Search aria-hidden className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar time ou camisa" aria-label="Buscar camisa" className="h-10 pl-9" />
        </div>
        {!query && (
          <div role="tablist" aria-label="Coleções" className="flex gap-1 overflow-x-auto pb-1">
            {JERSEY_CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                role="tab"
                aria-selected={category === c.id}
                onClick={() => setCategory(c.id)}
                className={cn('shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ring-white/10', category === c.id ? 'bg-amber-300 text-violet-950' : 'bg-violet-950/40 text-violet-100')}
              >
                {c.label}
              </button>
            ))}
          </div>
        )}
        <div className="grid max-h-56 grid-cols-3 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-4">
          {jerseys.map((j) => (
            <button
              key={j.id}
              type="button"
              aria-pressed={config.jersey === j.id}
              onClick={() => onChange(encodeCharacter({ ...config, jersey: j.id, number: j.defaultNumber ?? config.number }))}
              className={cn(
                'flex min-h-16 flex-col items-center gap-1 rounded-xl p-1.5 text-[11px] leading-tight font-semibold ring-1 transition-colors',
                config.jersey === j.id ? 'bg-amber-300/20 text-amber-100 ring-amber-300' : 'bg-violet-950/30 text-violet-100 ring-white/10 hover:bg-violet-900/40',
              )}
            >
              <span aria-hidden className="h-7 w-8 rounded-t-lg rounded-b-sm ring-1 ring-black/20" style={{ background: jerseyBackground(j) }} />
              <span className="line-clamp-2 text-center">{j.name}</span>
            </button>
          ))}
          {jerseys.length === 0 && <p className="text-muted-foreground col-span-full py-4 text-center text-xs">Nenhuma camisa encontrada.</p>}
        </div>
        <label className="flex items-center justify-between gap-3 pt-1 text-sm font-semibold text-violet-100">
          Número nas costas
          <Input
            type="number"
            inputMode="numeric"
            min={1}
            max={MAX_BACK_NUMBER}
            placeholder="—"
            value={config.number || ''}
            onChange={(e) => onChange(encodeCharacter({ ...config, number: Number(e.target.value) || 0 }))}
            onFocus={() => setFacing('back')}
            className="h-10 w-20 text-center text-lg font-bold tabular-nums"
          />
        </label>
      </fieldset>
    </div>
  );
}

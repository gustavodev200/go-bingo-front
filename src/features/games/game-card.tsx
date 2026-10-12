'use client';

import { Loader2, Lock, Play } from 'lucide-react';
import Link, { useLinkStatus } from 'next/link';
import type { CSSProperties } from 'react';
import { cn } from '@/lib/utils';
import type { Game } from './catalog';

const STATUS_LABEL: Record<Game['status'], string> = { available: 'Disponível', 'coming-soon': 'Em breve' };

/** Fixed-size CTA; swaps the play icon for a spinner while the game route loads. */
function PlayCta() {
  const { pending } = useLinkStatus();
  return (
    <span className="bg-primary text-primary-foreground inline-flex h-11 items-center gap-2 rounded-xl px-5 font-bold shadow-[0_4px_0_var(--primary-shadow)] transition-transform group-hover:-translate-y-0.5 group-active:translate-y-0.5 group-active:shadow-none">
      {pending ? <Loader2 aria-hidden className="size-5 animate-spin" /> : <Play aria-hidden className="size-5 fill-current" />}
      {pending ? 'Abrindo…' : 'Jogar'}
    </span>
  );
}

export function GameCard({ game }: { game: Game }) {
  const available = game.status === 'available';
  const { Art } = game;

  const content = (
    <>
      <div className="relative h-44 overflow-hidden sm:h-48">
        <Art />
        <span
          className={cn(
            'absolute top-3 left-3 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold backdrop-blur-md',
            available ? 'bg-emerald-400/15 text-emerald-200 ring-1 ring-emerald-300/40' : 'bg-violet-950/60 text-violet-200 ring-1 ring-white/15',
          )}
        >
          {available ? (
            <span aria-hidden className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75 motion-reduce:animate-none" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
            </span>
          ) : (
            <Lock aria-hidden className="size-3" />
          )}
          {STATUS_LABEL[game.status]}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-5">
        <h3 className="font-display text-marquee text-2xl font-bold">{game.name}</h3>
        <p className="text-muted-foreground text-sm leading-relaxed">{game.description}</p>
        <ul className="flex flex-wrap gap-1.5" aria-label="Destaques">
          {game.tags.map((tag) => (
            <li key={tag} className="rounded-full bg-white/8 px-2.5 py-0.5 text-xs font-medium text-violet-100 ring-1 ring-white/10">
              {tag}
            </li>
          ))}
        </ul>
        <div className="mt-auto flex justify-end pt-1">{available ? <PlayCta /> : <span className="text-sm font-semibold text-violet-200/70">Em breve no salão</span>}</div>
      </div>
    </>
  );

  const base = 'glass group flex h-full flex-col overflow-hidden transition duration-300 motion-reduce:transition-none';

  if (!available) {
    return (
      <article data-status={game.status} className={cn(base, 'opacity-70 grayscale-[0.6]')}>
        {content}
      </article>
    );
  }
  return (
    <Link
      href={game.href}
      aria-label={`Jogar ${game.name}`}
      style={{ '--glow': game.glow } as CSSProperties}
      className={cn(
        base,
        'outline-none hover:-translate-y-1 hover:border-[color-mix(in_oklch,var(--glow),transparent_40%)] hover:shadow-[0_18px_60px_-18px_var(--glow)] focus-visible:-translate-y-1 focus-visible:ring-4 focus-visible:ring-[color-mix(in_oklch,var(--glow),transparent_30%)] active:scale-[0.98]',
      )}
    >
      {content}
    </Link>
  );
}

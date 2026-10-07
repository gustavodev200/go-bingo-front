'use client';

import { useEffect, useRef } from 'react';
import { EMOTE_SYMBOLS } from '@/contracts';
import { cn } from '@/lib/utils';
import { REACTION_MS, useGameStore, type Reaction } from '../store';
import { EMOTE_LABELS } from './labels';

/** Quantas reações aparecem ao mesmo tempo no feed. */
const VISIBLE = 4;

function ReactionItem({ reaction, name }: { reaction: Reaction; name: string }) {
  return (
    <li className="flex items-center gap-1.5 rounded-full bg-black/45 py-0.5 pr-3 pl-1 text-sm font-semibold text-white backdrop-blur-sm motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3">
      <span aria-hidden className="text-2xl leading-none">
        {EMOTE_SYMBOLS[reaction.emote]}
      </span>
      <span aria-hidden className="max-w-28 truncate">
        {name}
      </span>
      <span className="sr-only">{`${name} reagiu: ${EMOTE_LABELS[reaction.emote].toLowerCase()}`}</span>
    </li>
  );
}

/**
 * Reações recentes em DOM (2D e 3D). Cada reação expira REACTION_MS depois de chegar, esteja visível ou não
 * (numa rajada, as antigas não podem reaparecer quando as novas somem). No 3D a bolha sobre o boneco complementa.
 */
export function ReactionFeed({ className }: { className?: string }) {
  const reactions = useGameStore((s) => s.reactions);
  const dismiss = useGameStore((s) => s.dismissReaction);
  const members = useGameStore((s) => s.snapshot?.members);
  const myUserId = useGameStore((s) => s.myUserId);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    for (const r of reactions) {
      if (timers.current.has(r.id)) continue;
      timers.current.set(
        r.id,
        setTimeout(() => {
          timers.current.delete(r.id);
          dismiss(r.id);
        }, REACTION_MS),
      );
    }
  }, [reactions, dismiss]);

  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach(clearTimeout);
      pending.clear();
    };
  }, []);

  const name = (userId: string) => (userId === myUserId ? 'Você' : (members?.find((m) => m.userId === userId)?.nickname ?? 'Alguém'));

  return (
    <ul role="log" aria-live="polite" aria-label="Reações" className={cn('pointer-events-none flex flex-col items-start gap-1', className)}>
      {reactions.slice(-VISIBLE).map((r) => (
        <ReactionItem key={r.id} reaction={r} name={name(r.userId)} />
      ))}
    </ul>
  );
}

'use client';

import { Lock } from 'lucide-react';
import { useContext, useState } from 'react';
import { stakeOptions, TIERS, tierIndexFor, type ArenaGame } from '@/contracts';
import { Coins } from '@/components/stage/coin';
import { ProfileContext } from '@/features/profile/profile-context';
import { cn } from '@/lib/utils';

interface StakePickerProps {
  game: ArenaGame;
  stake: number;
  /** Só o anfitrião escolhe; os outros veem o valor. */
  editable: boolean;
  onChange?(stake: number): Promise<unknown> | void;
  /** Jogadores na mesa: mostra o pote que está em jogo. */
  players?: number;
  variant?: 'dark' | 'light';
  className?: string;
}

/**
 * Quanto a mesa vale: o anfitrião escolhe entre os níveis do jogo (mesas altas pedem liga e a casa
 * fica com uma taxa do pote). Bônus e pontos não mudam com a aposta.
 */
export function StakePicker({ game, stake, editable, onChange, players, variant = 'dark', className }: StakePickerProps) {
  const ctx = useContext(ProfileContext);
  const myTier = ctx ? tierIndexFor(ctx.profile.points) : 0;
  const [pending, setPending] = useState(false);
  const options = stakeOptions(game);
  const current = options.find((o) => o.stake === stake) ?? options[0];
  const light = variant === 'light';

  async function pick(value: number) {
    if (!onChange || pending || value === stake) return;
    setPending(true);
    try {
      await onChange(value);
    } finally {
      setPending(false);
    }
  }

  return (
    <section
      aria-label="Aposta da mesa"
      className={cn('flex flex-col gap-2 rounded-2xl px-3 py-3', light ? 'border-2 border-black bg-white/90 text-slate-900' : 'bg-amber-300/10 text-amber-100 ring-1 ring-amber-300/25', className)}
    >
      <p className="text-center text-xs">
        {game === 'INFILTRADO' ? 'Cada um aposta' : 'Valendo'} <Coins amount={stake} className="align-middle" /> por jogador
        {players !== undefined && players > 1 && (
          <>
            {' '}
            · pote <Coins amount={stake * players} className="align-middle" />
          </>
        )}
        {current.rake > 0 && <span className={light ? 'text-slate-600' : 'text-amber-100/70'}> · casa fica com {Math.round(current.rake * 100)}%</span>}
      </p>
      <fieldset disabled={!editable || pending} className="grid grid-cols-5 gap-1.5">
        <legend className="sr-only">Escolha a aposta{editable ? '' : ' (o anfitrião escolhe)'}</legend>
        {options.map((o) => {
          const locked = o.minTier > myTier;
          return (
            <label
              key={o.id}
              title={locked ? `Precisa da liga ${TIERS[o.minTier].label}` : o.label}
              className={cn(
                'relative flex min-h-11 cursor-pointer flex-col items-center justify-center rounded-xl border px-1 py-1 text-center transition has-disabled:cursor-default has-focus-visible:ring-2 has-focus-visible:ring-amber-300',
                light ? 'border-slate-300 has-checked:border-black has-checked:bg-amber-300' : 'border-white/15 has-checked:border-amber-300 has-checked:bg-amber-300/20',
                !editable && o.stake !== stake && 'opacity-40',
                locked && 'opacity-50',
              )}
            >
              <input type="radio" name={`stake-${game}`} className="sr-only" checked={o.stake === stake} disabled={locked && o.stake !== stake} onChange={() => void pick(o.stake)} />
              <span className="text-[10px] leading-tight font-semibold">{o.label}</span>
              <span className="text-xs font-black tabular-nums">{o.stake}</span>
              {locked && <Lock aria-label={`Liga ${TIERS[o.minTier].label}`} className="absolute top-0.5 right-0.5 size-2.5" />}
            </label>
          );
        })}
      </fieldset>
      {editable && (
        <p className={cn('text-center text-[11px]', light ? 'text-slate-600' : 'text-amber-100/70')}>Todo mundo precisa ter o valor para entrar. Mudar a aposta pede &quot;pronto&quot; de novo.</p>
      )}
    </section>
  );
}

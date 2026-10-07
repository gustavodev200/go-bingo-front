import { BingoBall } from '@/components/stage/stage';
import { letterFor } from '@/contracts';
import { cn } from '@/lib/utils';

/** Tamanho cresce com a área do palco (retrato: limitado pela altura; paisagem: metade da largura). Texto em `cqw` acompanha a bola. */
const BIG = 'w-[min(40vw,22dvh)] landscape:w-[min(22vw,38dvh)] @container';
const SMALL = 'w-[min(15vw,8dvh)] landscape:w-[min(8vw,14dvh)] @container';

/** Bola sorteada em destaque no centro e as 3 anteriores embaixo (mais recente à esquerda). */
export function LastNumbers({ drawn, className }: { drawn: readonly number[]; className?: string }) {
  const current = drawn.at(-1);
  const previous = drawn.slice(-4, -1).reverse();

  return (
    <div className={cn('flex flex-col items-center gap-3', className)}>
      <div role="status" aria-live="polite" className="drop-shadow-[0_0_28px_rgb(251_191_36/0.55)]">
        {current === undefined ? (
          <BingoBall color="#a78bfa" className={BIG} faceClassName="w-[70%] px-2 text-center text-[length:10cqw] font-semibold">
            Aguardando o primeiro número
          </BingoBall>
        ) : (
          <span data-testid="current-number">
            <BingoBall key={current} letter={letterFor(current)} className={cn(BIG, 'animate-in zoom-in-50 spin-in-12 duration-500')} faceClassName="flex flex-col">
              <span className="text-[length:11cqw] font-bold">{letterFor(current)}</span>
              <span className="sr-only"> </span>
              <span className="font-display text-[length:26cqw] leading-none font-bold">{current}</span>
            </BingoBall>
          </span>
        )}
      </div>
      {previous.length > 0 && (
        <ol aria-label="Números anteriores" className="flex gap-3">
          {previous.map((n) => (
            <li key={n}>
              <BingoBall letter={letterFor(n)} className={cn(SMALL, 'animate-in fade-in duration-500')} faceClassName="flex flex-col">
                <span className="text-[length:12cqw] font-bold">{letterFor(n)}</span>
                <span className="font-display text-[length:24cqw] leading-none font-bold">{n}</span>
              </BingoBall>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

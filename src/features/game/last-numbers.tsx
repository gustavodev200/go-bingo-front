import { BingoBall } from '@/components/stage/stage';
import { letterFor } from '@/contracts';

export function LastNumbers({ drawn }: { drawn: readonly number[] }) {
  const current = drawn.at(-1);
  const previous = drawn.slice(-5, -1).reverse();

  return (
    <div className="flex flex-col items-center gap-3">
      <div role="status" aria-live="polite">
        {current === undefined ? (
          <BingoBall color="#a78bfa" className="w-32" faceClassName="w-[70%] px-2 text-center text-xs font-semibold">
            Aguardando o primeiro número
          </BingoBall>
        ) : (
          <BingoBall key={current} letter={letterFor(current)} className="animate-in zoom-in-50 spin-in-12 w-32 duration-500" faceClassName="flex flex-col">
            <span className="text-base font-bold">{letterFor(current)}</span>
            <span className="sr-only"> </span>
            <span className="font-display text-5xl leading-none font-bold">{current}</span>
          </BingoBall>
        )}
      </div>
      {previous.length > 0 && (
        <ol aria-label="Números anteriores" className="flex gap-2">
          {previous.map((n) => (
            <li key={n}>
              <BingoBall letter={letterFor(n)} className="w-12" faceClassName="text-[11px]">
                {letterFor(n)}
                {n}
              </BingoBall>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

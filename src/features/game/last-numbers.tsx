import { letterFor } from '@/contracts';

export function LastNumbers({ drawn }: { drawn: readonly number[] }) {
  const current = drawn.at(-1);
  const previous = drawn.slice(-5, -1).reverse();

  return (
    <div className="flex flex-col items-center gap-3">
      <div role="status" aria-live="polite" className="bg-primary text-primary-foreground flex size-28 flex-col items-center justify-center rounded-full shadow-lg">
        {current === undefined ? (
          <span className="px-3 text-center text-sm">Aguardando o primeiro número</span>
        ) : (
          <>
            <span className="text-lg font-bold">{letterFor(current)}</span>
            <span className="sr-only"> </span>
            <span className="text-5xl leading-none font-black">{current}</span>
          </>
        )}
      </div>
      {previous.length > 0 && (
        <ol aria-label="Números anteriores" className="flex gap-2">
          {previous.map((n) => (
            <li key={n} className="bg-muted flex size-11 items-center justify-center rounded-full text-sm font-bold">
              {letterFor(n)}
              {n}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

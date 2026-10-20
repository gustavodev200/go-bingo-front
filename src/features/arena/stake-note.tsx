import { ARENA_RULES, type ArenaGame } from '@/contracts';
import { Coins } from '@/components/stage/coin';

/** Quanto custa entrar e o que está em jogo: aparece no lobby de cada jogo. */
/** `stake` = aposta da mesa; ausente = mínimo do jogo. */
export function StakeNote({ game, stake, className }: { game: ArenaGame; stake?: number; className?: string }) {
  const rules = ARENA_RULES[game];
  const value = stake ?? rules.ante;
  return (
    <p className={className ?? 'rounded-2xl bg-amber-300/10 px-3 py-2 text-center text-xs text-amber-100 ring-1 ring-amber-300/25'}>
      {game === 'SNAKE' ? (
        <>
          Cada abate vale <Coins amount={value} className="align-middle" /> do abatido + pontos no ranking.
        </>
      ) : game === 'INFILTRADO' ? (
        <>
          Entrada <Coins amount={value} className="align-middle" /> por jogador · o time vencedor divide o pote + bônus e sobe no ranking.
        </>
      ) : (
        <>
          Entrada <Coins amount={value} className="align-middle" /> por jogador · o vencedor leva o pote + bônus e sobe no ranking.
        </>
      )}
    </p>
  );
}

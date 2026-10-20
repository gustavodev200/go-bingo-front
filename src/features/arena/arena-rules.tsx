import {
  ARENA_GAMES,
  ARENA_GAME_LABELS,
  ARENA_RULES,
  COMEBACK_COINS,
  COMEBACK_LOSSES,
  FIRST_WIN_OF_DAY_COINS,
  STREAK_CAP,
  STREAK_COINS_STEP,
  TIERS,
  UNDERDOG_COINS,
  WEEKLY_MIN_MATCHES,
  WEEKLY_PRIZES,
} from '@/contracts';

const LUCK: Record<string, string> = { BINGO: 'sorte', UNO: 'sorte e tática', DOMINO: 'sorte e tática', TRUCO: 'habilidade', SNAKE: 'habilidade', BOMBER: 'habilidade', INFILTRADO: 'dedução' };

/** Como funcionam moedas e ranking, igual para todos os jogos. */
export function ArenaRules() {
  return (
    <details className="glass rounded-2xl p-4 text-sm">
      <summary className="min-h-11 cursor-pointer py-2 font-display text-base font-semibold">Como funciona a Arena</summary>
      <div className="flex flex-col gap-4 pt-2 text-violet-100">
        <section className="flex flex-col gap-1">
          <h3 className="font-semibold text-amber-200">🪙 Moedas: o pote</h3>
          <p>Toda disputa tem uma entrada. As entradas formam o pote, e o vencedor leva tudo, mais um bônus da casa. Ninguém paga mais do que tem: o saldo nunca fica negativo.</p>
          <ul className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs">
            {ARENA_GAMES.map((g) => (
              <li key={g}>
                <strong>{ARENA_GAME_LABELS[g]}</strong>: entrada {ARENA_RULES[g].ante}, bônus {ARENA_RULES[g].winBonus}
              </li>
            ))}
          </ul>
          <p>Mesas de 4 ou mais jogadores dividem o pote 60% / 30% / 10% entre os três primeiros.</p>
        </section>

        <section className="flex flex-col gap-1">
          <h3 className="font-semibold text-amber-200">🏆 Pontos: o ranking é justo</h3>
          <p>Seus pontos seguem o modelo Elo: vencer um adversário mais forte vale mais; perder para um mais fraco custa mais. Quem está começando sobe mais rápido até o nível se acomodar. Todo jogo usa a mesma régua, mas jogos de sorte pesam menos que os de habilidade:</p>
          <ul className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs">
            {ARENA_GAMES.map((g) => (
              <li key={g}>
                <strong>{ARENA_GAME_LABELS[g]}</strong>: {LUCK[g]} (peso {ARENA_RULES[g].ratingWeight})
              </li>
            ))}
          </ul>
        </section>

        <section className="flex flex-col gap-1">
          <h3 className="font-semibold text-amber-200">🔥 Bônus que fazem valer a pena</h3>
          <ul className="list-disc pl-5">
            <li>Sequência de vitórias: +{STREAK_COINS_STEP} moedas e +1 ponto por vitória seguida (até {STREAK_CAP}).</li>
            <li>Primeira vitória do dia: +{FIRST_WIN_OF_DAY_COINS} moedas.</li>
            <li>Venceu quem era bem mais forte: +{UNDERDOG_COINS} moedas.</li>
            <li>Virada depois de {COMEBACK_LOSSES} derrotas seguidas: +{COMEBACK_COINS} moedas.</li>
            <li>Subir de liga paga um bônus único: {TIERS.slice(1).map((t) => `${t.label} +${t.bonus}`).join(' · ')}.</li>
          </ul>
        </section>

        <section className="flex flex-col gap-1">
          <h3 className="font-semibold text-amber-200">📅 Ranking da semana</h3>
          <p>
            Soma os pontos ganhos em todos os jogos de segunda a domingo. Com {WEEKLY_MIN_MATCHES} partidas pontuadas, o top 3 ganha {WEEKLY_PRIZES.join(' / ')} moedas quando a semana fecha.
          </p>
        </section>

        <section className="flex flex-col gap-1">
          <h3 className="font-semibold text-amber-200">🛡️ Contra abuso</h3>
          <ul className="list-disc pl-5">
            <li>Só pontua contra jogadores logados; convidados ganham e perdem moedas, mas não pontuam.</li>
            <li>Partida curta demais não pontua nem rende bônus.</li>
            <li>Enfrentar sempre os mesmos adversários rende cada vez menos em 24 horas.</li>
            <li>Sair no meio é derrota: paga a entrada de novo (vai para quem ficou) e perde pontos.</li>
            <li>CPU não pontua e não paga nada.</li>
          </ul>
        </section>
      </div>
    </details>
  );
}

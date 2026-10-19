import { ARENA_GAME_LABELS, type ProfileStats } from '@/contracts';
import { TierBadge, tierFor } from '@/features/arena/tier-badge';

function rankHint(stats: ProfileStats, isGuest: boolean): string | null {
  if (stats.rank !== null) return null;
  return isGuest ? 'Convidados não entram no ranking.' : 'Jogue uma partida para entrar no ranking.';
}

export function StatsGrid({ stats, isGuest }: { stats: ProfileStats; isGuest: boolean }) {
  const tiles = [
    { label: 'Partidas', value: String(stats.gamesPlayed) },
    { label: 'Vitórias', value: String(stats.wins) },
    { label: 'Pontos', value: String(stats.points) },
    { label: 'Ranking', value: stats.rank === null ? '—' : `${stats.rank}º` },
  ];
  const hint = rankHint(stats, isGuest);
  const { next } = tierFor(stats.points);
  const played = stats.perGame.filter((g) => g.played > 0);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-center gap-2">
        <TierBadge points={stats.points} className="text-sm" />
        {stats.streak >= 2 && <span className="rounded-full bg-orange-400/15 px-2 py-0.5 text-sm font-bold text-orange-200 ring-1 ring-orange-300/40">🔥 {stats.streak} vitórias seguidas</span>}
        {stats.bestStreak >= 2 && <span className="text-xs text-violet-200/70">recorde: {stats.bestStreak}</span>}
      </div>
      <dl className="grid grid-cols-2 gap-2">
        {tiles.map((t) => (
          <div key={t.label} className="glass flex flex-col items-center gap-0.5 rounded-2xl px-3 py-3">
            <dt className="text-xs font-semibold tracking-widest text-violet-200/70 uppercase">{t.label}</dt>
            <dd className="font-display text-2xl font-bold text-amber-200 tabular-nums">{t.value}</dd>
          </div>
        ))}
      </dl>
      {next && !isGuest && (
        <p className="text-muted-foreground text-center text-xs">
          Faltam {next.min - stats.points} pts para {next.label} (+{next.bonus} moedas).
        </p>
      )}
      {played.length > 0 && (
        <ul className="grid grid-cols-2 gap-1.5 text-xs" aria-label="Por jogo">
          {played.map((g) => (
            <li key={g.game} className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2">
              <span className="font-semibold">{ARENA_GAME_LABELS[g.game]}</span>
              <span className="text-violet-200/80 tabular-nums">
                {g.wins}/{g.played}
              </span>
            </li>
          ))}
        </ul>
      )}
      {hint && <p className="text-muted-foreground text-center text-xs">{hint}</p>}
    </div>
  );
}

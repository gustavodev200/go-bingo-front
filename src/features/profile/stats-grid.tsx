import type { ProfileStats } from '@/contracts';

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

  return (
    <div className="flex flex-col gap-2">
      <dl className="grid grid-cols-2 gap-2">
        {tiles.map((t) => (
          <div key={t.label} className="glass flex flex-col items-center gap-0.5 rounded-2xl px-3 py-3">
            <dt className="text-xs font-semibold tracking-widest text-violet-200/70 uppercase">{t.label}</dt>
            <dd className="font-display text-2xl font-bold text-amber-200 tabular-nums">{t.value}</dd>
          </div>
        ))}
      </dl>
      {hint && <p className="text-muted-foreground text-center text-xs">{hint}</p>}
    </div>
  );
}

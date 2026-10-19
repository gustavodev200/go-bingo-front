import { render, screen } from '@testing-library/react';
import type { MatchResultDto } from '@/contracts';
import { MatchRewardPanel } from './reward-panel';
import { StakeNote } from './stake-note';
import { TierBadge, tierFor } from './tier-badge';

let hook: { reward: MatchResultDto | null; status: 'waiting' | 'ready' | 'missing' };
vi.mock('./use-match-reward', () => ({ useMatchReward: () => hook }));

const base: MatchResultDto = {
  matchId: '00000000-0000-4000-8000-0000000000aa',
  game: 'TRUCO',
  placement: 1,
  players: 2,
  won: true,
  abandoned: false,
  pointsDelta: 14,
  coinsDelta: 105,
  staked: 40,
  prize: 80,
  bonuses: [
    { code: 'FINISH', amount: 5 },
    { code: 'WIN', amount: 60 },
  ],
  streak: 1,
  points: 114,
  tierUp: null,
  rated: true,
  createdAt: '2026-10-19T12:00:00.000Z',
};

describe('MatchRewardPanel', () => {
  it('waits for the settlement, then shows the whole statement', () => {
    hook = { reward: null, status: 'waiting' };
    const { rerender } = render(<MatchRewardPanel />);
    expect(screen.getByText(/calculando suas recompensas/i)).toBeInTheDocument();

    hook = { reward: base, status: 'ready' };
    rerender(<MatchRewardPanel />);
    const panel = screen.getByRole('region', { name: /recompensas da partida/i });
    expect(panel).toHaveTextContent('+105 moedas');
    expect(panel).toHaveTextContent('+14 pts');
    expect(panel).toHaveTextContent('Entrada');
    expect(panel).toHaveTextContent('−40 moedas');
    expect(panel).toHaveTextContent('Pote da mesa');
    expect(panel).toHaveTextContent('Bônus de vitória');
    expect(panel).toHaveTextContent('Partida concluída');
  });

  it('celebrates streaks and promotions', () => {
    hook = {
      reward: { ...base, streak: 3, tierUp: { tier: 'PRATA', coins: 100 }, points: 152 },
      status: 'ready',
    };
    render(<MatchRewardPanel />);
    expect(screen.getByText(/3 vitórias seguidas/)).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Nova liga: Prata!');
  });

  it('explains why a loss or an unrated match gave no points', () => {
    hook = {
      reward: { ...base, won: false, placement: 2, pointsDelta: 0, rated: false, coinsDelta: -35, prize: 0, bonuses: [{ code: 'FINISH', amount: 5 }], streak: -3 },
      status: 'ready',
    };
    render(<MatchRewardPanel />);
    expect(screen.getByText(/precisa de uma partida completa contra outro jogador logado/i)).toBeInTheDocument();
    expect(screen.getByText(/3 derrotas seguidas/)).toBeInTheDocument();
  });

  it('tells a leaver what leaving costs', () => {
    hook = { reward: { ...base, won: false, abandoned: true, rated: false, pointsDelta: -9, coinsDelta: -80, prize: 0, bonuses: [] }, status: 'ready' };
    render(<MatchRewardPanel />);
    expect(screen.getByText(/quem sai no meio perde pontos e paga multa/i)).toBeInTheDocument();
  });

  it('shows nothing when no result ever arrived', () => {
    hook = { reward: null, status: 'missing' };
    const { container } = render(<MatchRewardPanel />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('StakeNote', () => {
  it('shows the entry fee of each game and the kill bounty in Snake', () => {
    const { rerender } = render(<StakeNote game="UNO" />);
    expect(screen.getByText(/entrada/i)).toHaveTextContent(/Entrada \$?30 moedas por jogador/);
    rerender(<StakeNote game="SNAKE" />);
    expect(screen.getByText(/cada abate vale/i)).toHaveTextContent(/\$?10 moedas do abatido/);
  });
});

describe('TierBadge', () => {
  it('maps points to leagues and the next goal', () => {
    render(<TierBadge points={160} />);
    expect(screen.getByText('Prata')).toBeInTheDocument();
    expect(tierFor(0).tier.label).toBe('Bronze');
    expect(tierFor(3000).next).toBeNull();
    expect(tierFor(399).next?.label).toBe('Ouro');
  });
});

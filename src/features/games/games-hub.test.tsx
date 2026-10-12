import { render, screen, within } from '@testing-library/react';
import type { Game } from './catalog';
import { GameCard } from './game-card';
import { GamesHub } from './games-hub';

vi.mock('@/features/profile/profile-context', () => ({
  useProfile: () => ({ profile: { id: '00000000-0000-4000-8000-000000000001', nickname: 'Ana', character: 'c03', isGuest: false, points: 20, coins: 980 }, refresh: vi.fn() }),
}));
vi.mock('@/features/auth/use-logout', () => ({ useLogout: () => vi.fn() }));

describe('GamesHub', () => {
  it('greets the player and keeps their profile at hand', () => {
    render(<GamesHub />);
    expect(screen.getByRole('heading', { level: 1, name: 'Escolha seu jogo' })).toBeInTheDocument();
    expect(screen.getByText(/bem-vindo, ana/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /abrir seu perfil \(ana\)/i })).toHaveAttribute('href', '/perfil');
  });

  it('lists the bingo as an available game leading to its lobby', () => {
    render(<GamesHub />);
    const card = screen.getByRole('link', { name: 'Jogar Bingo' });
    expect(card).toHaveAttribute('href', '/bingo');
    expect(within(card).getByText('Disponível')).toBeInTheDocument();
  });

  it('lists the Truco Mineiro leading to its lobby', () => {
    render(<GamesHub />);
    const card = screen.getByRole('link', { name: 'Jogar Truco Mineiro' });
    expect(card).toHaveAttribute('href', '/truco');
    expect(within(card).getByText('4 jogadores')).toBeInTheDocument();
  });
});

describe('GameCard', () => {
  it('renders a coming-soon game without a link', () => {
    const game: Game = { id: 'soon', name: 'Outro', description: 'Logo mais.', href: '/outro', status: 'coming-soon', tags: [], glow: '#fff', Art: () => null };
    render(<GameCard game={game} />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByRole('article')).toHaveAttribute('data-status', 'coming-soon');
    expect(screen.getAllByText(/em breve/i).length).toBeGreaterThan(0);
  });
});

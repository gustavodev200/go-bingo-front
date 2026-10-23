import { render, screen, within } from '@testing-library/react';
import type { Game } from './catalog';
import { GameCard } from './game-card';
import { GamesHub } from './games-hub';

vi.mock('@/features/profile/profile-context', () => ({
  useProfile: () => ({ profile: { id: '00000000-0000-4000-8000-000000000001', nickname: 'Ana', character: 'c03', isGuest: false, points: 20, coins: 980 }, refresh: vi.fn() }),
}));
vi.mock('@/features/auth/use-logout', () => ({ useLogout: () => vi.fn() }));
const presence = vi.hoisted(() => ({ online: null as number | null }));
vi.mock('@/features/presence/presence-context', () => ({ useOnlineCount: () => presence.online }));

describe('GamesHub', () => {
  afterEach(() => {
    presence.online = null;
  });

  it('shows how many players are online once the server tells', () => {
    const { rerender } = render(<GamesHub />);
    expect(screen.queryByText(/online/i)).not.toBeInTheDocument();
    presence.online = 4;
    rerender(<GamesHub />);
    expect(screen.getByText('4 onlines')).toBeInTheDocument();
    presence.online = 1;
    rerender(<GamesHub />);
    expect(screen.getByText('1 online')).toBeInTheDocument();
  });

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

  it('lists the Truco leading to its lobby', () => {
    render(<GamesHub />);
    const card = screen.getByRole('link', { name: 'Jogar Truco' });
    expect(card).toHaveAttribute('href', '/truco');
    expect(within(card).getByText('4 jogadores')).toBeInTheDocument();
  });

  it('lists the Truco Gaudério leading to its lobby', () => {
    render(<GamesHub />);
    const card = screen.getByRole('link', { name: 'Jogar Truco Gaudério/Argentino' });
    expect(card).toHaveAttribute('href', '/gauderio');
    expect(within(card).getByText('2 ou 4 jogadores')).toBeInTheDocument();
  });

  it('lists the UNO leading to its lobby', () => {
    render(<GamesHub />);
    const card = screen.getByRole('link', { name: 'Jogar UNO' });
    expect(card).toHaveAttribute('href', '/uno');
    expect(within(card).getByText('2 a 6 jogadores')).toBeInTheDocument();
  });

  it('lists the Dominó leading to its lobby', () => {
    render(<GamesHub />);
    const card = screen.getByRole('link', { name: 'Jogar Dominó' });
    expect(card).toHaveAttribute('href', '/domino');
    expect(within(card).getByText('2 a 4 jogadores')).toBeInTheDocument();
  });

  it('lists the Damas leading to its lobby', () => {
    render(<GamesHub />);
    const card = screen.getByRole('link', { name: 'Jogar Damas' });
    expect(card).toHaveAttribute('href', '/damas');
    expect(within(card).getByText('2 jogadores')).toBeInTheDocument();
  });

  it('lists the Tacada leading to its lobby', () => {
    render(<GamesHub />);
    const card = screen.getByRole('link', { name: 'Jogar Tacada' });
    expect(card).toHaveAttribute('href', '/tacada');
    expect(within(card).getByText('Bilhar')).toBeInTheDocument();
  });

  it('lists the Blackjack leading to its lobby', () => {
    render(<GamesHub />);
    const card = screen.getByRole('link', { name: 'Jogar Blackjack' });
    expect(card).toHaveAttribute('href', '/blackjack');
    expect(within(card).getByText('1 a 5 jogadores')).toBeInTheDocument();
  });

  it('lists the Bomberman leading to its lobby', () => {
    render(<GamesHub />);
    const card = screen.getByRole('link', { name: 'Jogar Bomberman' });
    expect(card).toHaveAttribute('href', '/bomber');
    expect(within(card).getByText('2 a 8 jogadores')).toBeInTheDocument();
  });

  it('lists the Snake.io leading to its arena', () => {
    render(<GamesHub />);
    const card = screen.getByRole('link', { name: 'Jogar Snake.io' });
    expect(card).toHaveAttribute('href', '/snake');
    expect(within(card).getByText('Até 20 jogadores')).toBeInTheDocument();
  });

  it('lists the Infiltrado leading to its lobby', () => {
    render(<GamesHub />);
    const card = screen.getByRole('link', { name: 'Jogar Infiltrado' });
    expect(card).toHaveAttribute('href', '/infiltrado');
    expect(within(card).getByText('4 a 15 jogadores')).toBeInTheDocument();
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

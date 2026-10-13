import { render, screen } from '@testing-library/react';
import { TentoPiles } from './tento-piles';

const seeds = (id: string) => screen.getByTestId(id).querySelectorAll('span[style]');
const pulled = (id: string) => screen.getByTestId(id).querySelectorAll('[data-pulled]');

describe('TentoPiles', () => {
  it('splits the seeds between the middle heap and each team, from my side', () => {
    render(<TentoPiles scores={[3, 7]} mySeat={1} targetScore={12} />);
    expect(screen.getByTestId('tentos-us')).toHaveAttribute('data-count', '7');
    expect(screen.getByTestId('tentos-them')).toHaveAttribute('data-count', '3');
    expect(screen.getByTestId('tentos-monte')).toHaveAttribute('data-count', '13');
    expect(seeds('tentos-monte')).toHaveLength(13);
    expect(screen.getByText('Nós 7')).toBeInTheDocument();
  });

  it('puts each pile next to the same puller of each team on every screen', () => {
    const { unmount } = render(<TentoPiles scores={[0, 0]} mySeat={0} targetScore={12} />);
    // Seat 0 (me) pulls for us; seat 1 (to my right) pulls for them.
    expect(screen.getByTestId('tentos-us')).toHaveAttribute('data-position', 'bottom');
    expect(screen.getByTestId('tentos-them')).toHaveAttribute('data-position', 'right');
    unmount();
    render(<TentoPiles scores={[0, 0]} mySeat={2} targetScore={12} />);
    // From seat 2, my partner (seat 0) is on top and seat 1 is on my left.
    expect(screen.getByTestId('tentos-us')).toHaveAttribute('data-position', 'top');
    expect(screen.getByTestId('tentos-them')).toHaveAttribute('data-position', 'left');
  });

  it('does not animate seeds already on the table when joining mid-match', () => {
    render(<TentoPiles scores={[4, 2]} mySeat={0} targetScore={12} />);
    expect(pulled('tentos-us')).toHaveLength(0);
    expect(pulled('tentos-them')).toHaveLength(0);
  });

  it('sizes the monte for the goiano game to 15', () => {
    render(<TentoPiles scores={[0, 0]} mySeat={0} targetScore={15} />);
    expect(screen.getByTestId('tentos-monte')).toHaveAttribute('data-count', '29');
  });

  it('pulls only the new tentos to the scoring team, staggered', () => {
    const { rerender } = render(<TentoPiles scores={[1, 0]} mySeat={0} targetScore={12} />);
    rerender(<TentoPiles scores={[4, 0]} mySeat={0} targetScore={12} />);
    const fresh = pulled('tentos-us');
    expect(fresh).toHaveLength(3);
    expect((fresh[0] as HTMLElement).style.animationDelay).toBe('0ms');
    expect((fresh[2] as HTMLElement).style.animationDelay).toBe('280ms');
    expect(pulled('tentos-them')).toHaveLength(0);
    expect(screen.getByTestId('tentos-monte')).toHaveAttribute('data-count', '19');
  });

  it('starts over on a new match', () => {
    const { rerender } = render(<TentoPiles scores={[10, 8]} mySeat={0} targetScore={12} />);
    rerender(<TentoPiles scores={[0, 0]} mySeat={0} targetScore={12} />);
    rerender(<TentoPiles scores={[0, 1]} mySeat={0} targetScore={12} />);
    expect(pulled('tentos-them')).toHaveLength(1);
    expect(screen.getByTestId('tentos-monte')).toHaveAttribute('data-count', '22');
  });
});

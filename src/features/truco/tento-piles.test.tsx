import { render, screen } from '@testing-library/react';
import { TentoPiles } from './tento-piles';

const seeds = (id: string) => screen.getByTestId(id).querySelectorAll('span[style]');
const pulled = (id: string) => screen.getByTestId(id).querySelectorAll('[data-pulled]');

describe('TentoPiles', () => {
  it('splits the seeds between the middle heap and each team, from my side', () => {
    render(<TentoPiles scores={[3, 7]} myTeam={1} />);
    expect(screen.getByTestId('tentos-us')).toHaveAttribute('data-count', '7');
    expect(screen.getByTestId('tentos-them')).toHaveAttribute('data-count', '3');
    expect(screen.getByTestId('tentos-monte')).toHaveAttribute('data-count', '13');
    expect(seeds('tentos-monte')).toHaveLength(13);
    expect(screen.getByText('Nós 7')).toBeInTheDocument();
  });

  it('does not animate seeds already on the table when joining mid-match', () => {
    render(<TentoPiles scores={[4, 2]} myTeam={0} />);
    expect(pulled('tentos-us')).toHaveLength(0);
    expect(pulled('tentos-them')).toHaveLength(0);
  });

  it('pulls only the new tentos to the scoring team, staggered', () => {
    const { rerender } = render(<TentoPiles scores={[1, 0]} myTeam={0} />);
    rerender(<TentoPiles scores={[4, 0]} myTeam={0} />);
    const fresh = pulled('tentos-us');
    expect(fresh).toHaveLength(3);
    expect((fresh[0] as HTMLElement).style.animationDelay).toBe('0ms');
    expect((fresh[2] as HTMLElement).style.animationDelay).toBe('280ms');
    expect(pulled('tentos-them')).toHaveLength(0);
    expect(screen.getByTestId('tentos-monte')).toHaveAttribute('data-count', '19');
  });

  it('starts over on a new match', () => {
    const { rerender } = render(<TentoPiles scores={[10, 8]} myTeam={0} />);
    rerender(<TentoPiles scores={[0, 0]} myTeam={0} />);
    rerender(<TentoPiles scores={[0, 1]} myTeam={0} />);
    expect(pulled('tentos-them')).toHaveLength(1);
    expect(screen.getByTestId('tentos-monte')).toHaveAttribute('data-count', '22');
  });
});

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CardGrid } from './card-grid';

// Coluna-major: B = 1..5, I = 16..20, N = 31,32,★,33,34, G = 46..50, O = 61..65
const grid = [1, 2, 3, 4, 5, 16, 17, 18, 19, 20, 31, 32, 0, 33, 34, 46, 47, 48, 49, 50, 61, 62, 63, 64, 65];

describe('CardGrid', () => {
  it('renders columns under B-I-N-G-O with the free cell in the center', () => {
    render(<CardGrid grid={grid} marked={[]} drawn={new Set()} />);
    const cells = screen.getAllByRole('button');
    // Primeira linha visual: B1, I16, N31, G46, O61.
    expect(cells.slice(0, 5).map((c) => c.textContent)).toEqual(['1', '16', '31', '46', '61']);
    expect(screen.getByRole('button', { name: /casa livre/i })).toHaveAttribute('aria-pressed', 'true');
  });

  it('marks a drawn number', async () => {
    const onMark = vi.fn();
    render(<CardGrid grid={grid} marked={[]} drawn={new Set([17])} onMark={onMark} />);
    await userEvent.click(screen.getByRole('button', { name: 'I 17' }));
    expect(onMark).toHaveBeenCalledWith(6);
  });

  it('locked cell: does not mark and reports the number', async () => {
    const onMark = vi.fn();
    const onLocked = vi.fn();
    render(<CardGrid grid={grid} marked={[]} drawn={new Set()} onMark={onMark} onLocked={onLocked} />);
    await userEvent.click(screen.getByRole('button', { name: 'B 1' }));
    expect(onMark).not.toHaveBeenCalled();
    expect(onLocked).toHaveBeenCalledWith(1);
  });

  it('shows marked cells as pressed and ignores clicks on them', async () => {
    const onMark = vi.fn();
    render(<CardGrid grid={grid} marked={[0]} drawn={new Set([1])} onMark={onMark} />);
    const cell = screen.getByRole('button', { name: 'B 1, marcado' });
    expect(cell).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(cell);
    expect(onMark).not.toHaveBeenCalled();
  });
});

describe('CardGrid (como no bingo de verdade)', () => {
  it('does not reveal which numbers were drawn', () => {
    const { container: drawn } = render(<CardGrid grid={grid} marked={[]} drawn={new Set([1, 17, 33])} onMark={vi.fn()} />);
    const { container: none } = render(<CardGrid grid={grid} marked={[]} drawn={new Set()} onMark={vi.fn()} />);
    expect(drawn.innerHTML).toBe(none.innerHTML);
  });
});

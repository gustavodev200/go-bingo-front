import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DrawnBoard } from './drawn-board';

describe('DrawnBoard', () => {
  it('opens the 1–75 board with the drawn numbers lit', async () => {
    render(<DrawnBoard drawn={[1, 16, 75]} />);
    await userEvent.click(screen.getByRole('button', { name: 'Painel' }));
    const dialog = screen.getByRole('dialog');
    const cells = within(dialog).getAllByRole('listitem');
    expect(cells).toHaveLength(75);
    expect(cells.filter((c) => c.dataset.drawn === 'true').map((c) => c.textContent)).toEqual(['1', '16', '75']);
    expect(within(dialog).getByText('Números sorteados (3/75)')).toBeInTheDocument();
    expect(within(dialog).getByRole('list', { name: 'Coluna O' })).toBeInTheDocument();
  });
});

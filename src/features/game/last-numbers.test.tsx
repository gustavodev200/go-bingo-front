import { render, screen } from '@testing-library/react';
import { LastNumbers } from './last-numbers';

describe('LastNumbers', () => {
  it('before the first ball shows no ball, only that the game started', () => {
    render(<LastNumbers drawn={[]} />);
    expect(screen.getByRole('status')).toHaveTextContent('Começou!');
    expect(screen.queryByTestId('current-number')).not.toBeInTheDocument();
  });

  it('announces the current ball and lists the previous three', () => {
    render(<LastNumbers drawn={[3, 20, 40, 55, 70, 7]} />);
    expect(screen.getByRole('status')).toHaveTextContent('B 7');
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual(['O70', 'G55', 'N40']);
  });
});

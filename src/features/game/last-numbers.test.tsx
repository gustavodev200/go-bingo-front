import { render, screen } from '@testing-library/react';
import { LastNumbers } from './last-numbers';

describe('LastNumbers', () => {
  it('waits for the first number', () => {
    render(<LastNumbers drawn={[]} />);
    expect(screen.getByText(/aguardando o primeiro número/i)).toBeInTheDocument();
  });

  it('announces the current ball and lists the previous four', () => {
    render(<LastNumbers drawn={[3, 20, 40, 55, 70, 7]} />);
    expect(screen.getByRole('status')).toHaveTextContent('B 7');
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual(['O70', 'G55', 'N40', 'I20']);
  });
});

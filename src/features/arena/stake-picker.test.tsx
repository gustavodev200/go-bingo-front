import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StakePicker } from './stake-picker';

describe('StakePicker', () => {
  it('the host picks a value; the pot follows the table size', async () => {
    const onChange = vi.fn().mockResolvedValue(true);
    render(<StakePicker game="UNO" stake={30} players={3} editable onChange={onChange} />);
    expect(screen.getByLabelText('Aposta da mesa')).toHaveTextContent('pote $90 moedas');
    await userEvent.click(screen.getByRole('radio', { name: /Valendo/ }));
    expect(onChange).toHaveBeenCalledWith(60);
  });

  it('high tables are locked below the league and show the house rake', () => {
    render(<StakePicker game="UNO" stake={150} editable onChange={vi.fn()} />);
    expect(screen.getByRole('radio', { name: /High Roller/ })).toBeDisabled();
    expect(screen.getByLabelText('Aposta da mesa')).toHaveTextContent('casa fica com 5%');
  });

  it('guests at the table only see the value', () => {
    render(<StakePicker game="TRUCO" stake={80} editable={false} />);
    expect(screen.getByRole('radio', { name: /Valendo/ })).toBeChecked();
    expect(screen.getByRole('radio', { name: /Amistosa/ })).toBeDisabled();
  });

  it('a table with the CPU does not bet: shows the CPU rewards instead', () => {
    render(<StakePicker game="UNO" stake={30} editable onChange={vi.fn()} cpu={1} />);
    expect(screen.queryByLabelText('Aposta da mesa')).not.toBeInTheDocument();
    expect(screen.getByRole('note')).toHaveTextContent('não vale ranking nem aposta');
  });
});

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { JoinByCodeForm } from './join-by-code-form';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

describe('JoinByCodeForm', () => {
  beforeEach(() => vi.clearAllMocks());

  it('normalizes and navigates to the room', async () => {
    render(<JoinByCodeForm />);
    await userEvent.type(screen.getByLabelText(/código da sala/i), ' abc234 ');
    await userEvent.click(screen.getByRole('button', { name: /entrar/i }));
    expect(push).toHaveBeenCalledWith('/ABC234');
  });

  it('rejects ambiguous characters', async () => {
    render(<JoinByCodeForm />);
    await userEvent.type(screen.getByLabelText(/código da sala/i), 'ABC0O1');
    await userEvent.click(screen.getByRole('button', { name: /entrar/i }));
    expect(screen.getByRole('alert')).toHaveTextContent(/código inválido/i);
    expect(push).not.toHaveBeenCalled();
  });
});

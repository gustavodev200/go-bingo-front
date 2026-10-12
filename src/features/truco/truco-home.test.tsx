import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { roomState } from '@/test/truco-fixtures';
import { TrucoHome } from './truco-home';

const push = vi.fn();
const createTable = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('./connection', () => ({ createTable: () => createTable() }));
vi.mock('@/features/profile/profile-pill', () => ({ ProfilePill: () => null }));

describe('TrucoHome', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a table and opens it', async () => {
    createTable.mockResolvedValue({ ok: true, data: { state: roomState({ code: 'QWE234' }), mySeat: 0, hand: null } });
    render(<TrucoHome />);
    await userEvent.click(screen.getByRole('button', { name: 'Criar mesa' }));
    expect(push).toHaveBeenCalledWith('/truco/QWE234');
  });

  it('shows why a table could not be created', async () => {
    createTable.mockResolvedValue({ ok: false, error: { code: 'INVALID_STATE', message: 'Você já está na mesa ABC234. Saia dela antes' } });
    render(<TrucoHome />);
    await userEvent.click(screen.getByRole('button', { name: 'Criar mesa' }));
    expect(screen.getByRole('alert')).toHaveTextContent('ABC234');
  });

  it('joins by code and validates it', async () => {
    render(<TrucoHome />);
    await userEvent.type(screen.getByLabelText('Código da mesa'), 'abc');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(screen.getByRole('alert')).toHaveTextContent('6 letras');
    await userEvent.clear(screen.getByLabelText('Código da mesa'));
    await userEvent.type(screen.getByLabelText('Código da mesa'), 'abc234');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(push).toHaveBeenCalledWith('/truco/ABC234');
  });

  it('teaches the fixed manilhas', () => {
    render(<TrucoHome />);
    expect(screen.getByRole('img', { name: '4 de paus (Zap)' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Ás de espadas (Espadilha)' })).toBeInTheDocument();
  });
});

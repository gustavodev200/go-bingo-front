import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { roomState } from '@/test/uno-fixtures';
import { UnoHome } from './uno-home';

const push = vi.fn();
const createUnoTable = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
let publicRooms: unknown = [];
vi.mock('./connection', () => ({ createUnoTable: (isPublic: boolean) => createUnoTable(isPublic), usePublicUnoTables: () => publicRooms }));
vi.mock('@/features/profile/profile-pill', () => ({ ProfilePill: () => null }));

describe('UnoHome', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    publicRooms = [];
  });

  it('creates a private table and opens it', async () => {
    createUnoTable.mockResolvedValue({ ok: true, data: { state: roomState({ code: 'QWE234' }), mySeat: 0, hand: null } });
    render(<UnoHome />);
    await userEvent.click(screen.getByRole('radio', { name: /Privada/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Criar mesa' }));
    expect(createUnoTable).toHaveBeenCalledWith(false);
    expect(push).toHaveBeenCalledWith('/uno/QWE234');
  });

  it('shows why a table could not be created', async () => {
    createUnoTable.mockResolvedValue({ ok: false, error: { code: 'INVALID_STATE', message: 'Você já está na mesa ABC234. Saia dela antes' } });
    render(<UnoHome />);
    await userEvent.click(screen.getByRole('button', { name: 'Criar mesa' }));
    expect(screen.getByRole('alert')).toHaveTextContent('ABC234');
  });

  it('joins by code', async () => {
    render(<UnoHome />);
    await userEvent.type(screen.getByLabelText('Código da mesa'), 'abc');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(screen.getByRole('alert')).toHaveTextContent('6 letras');
    await userEvent.clear(screen.getByLabelText('Código da mesa'));
    await userEvent.type(screen.getByLabelText('Código da mesa'), 'abc234');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(push).toHaveBeenCalledWith('/uno/ABC234');
  });

  it('lists public tables with their mode', () => {
    publicRooms = [{ code: 'ZXC234', hostNickname: 'Bia', hostCharacter: null, players: 3, rules: { target: 200, stacking: true, sevenZero: false } }];
    render(<UnoHome />);
    const link = screen.getByRole('link', { name: /mesa de Bia, 3 de 6 jogadores/ });
    expect(link).toHaveAttribute('href', '/uno/ZXC234');
    expect(screen.getByText('Corrida dos 200')).toBeInTheDocument();
    expect(screen.getByText('Empilhar')).toBeInTheDocument();
  });

  it('invites to create when there is no public table', () => {
    render(<UnoHome />);
    expect(screen.getByText(/Nenhuma mesa pública agora/)).toBeInTheDocument();
  });
});

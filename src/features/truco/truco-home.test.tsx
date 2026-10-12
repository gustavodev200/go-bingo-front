import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { roomState } from '@/test/truco-fixtures';
import { TrucoHome } from './truco-home';

const push = vi.fn();
const createTable = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
let publicRooms: unknown = [];
vi.mock('./connection', () => ({ createTable: (isPublic: boolean) => createTable(isPublic), usePublicTables: () => publicRooms }));
vi.mock('@/features/profile/profile-pill', () => ({ ProfilePill: () => null }));

describe('TrucoHome', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a table and opens it', async () => {
    createTable.mockResolvedValue({ ok: true, data: { state: roomState({ code: 'QWE234' }), mySeat: 0, hand: null } });
    render(<TrucoHome />);
    await userEvent.click(screen.getByRole('button', { name: 'Criar mesa' }));
    expect(createTable).toHaveBeenCalledWith(true);
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

  it('creates a private table when chosen', async () => {
    createTable.mockResolvedValue({ ok: true, data: { state: roomState({ code: 'QWE234' }), mySeat: 0, hand: null } });
    render(<TrucoHome />);
    await userEvent.click(screen.getByRole('radio', { name: /Privada/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Criar mesa' }));
    expect(createTable).toHaveBeenCalledWith(false);
  });

  it('lists public tables with free seats', () => {
    publicRooms = [{ code: 'RTY234', hostNickname: 'Bia', hostCharacter: null, players: 3 }];
    render(<TrucoHome />);
    expect(screen.getByRole('link', { name: 'Entrar na mesa de Bia, 3 de 4 jogadores' })).toHaveAttribute('href', '/truco/RTY234');
    publicRooms = [];
  });

  it('says when there is no public table, or while loading', () => {
    const { unmount } = render(<TrucoHome />);
    expect(screen.getByText(/Nenhuma mesa pública/)).toBeInTheDocument();
    unmount();
    publicRooms = null;
    render(<TrucoHome />);
    expect(screen.getByText('Procurando mesas…')).toBeInTheDocument();
    publicRooms = [];
  });

  it('teaches the fixed manilhas', () => {
    render(<TrucoHome />);
    expect(screen.getByRole('img', { name: '4 de paus (Zap)' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Ás de espadas (Espadilha)' })).toBeInTheDocument();
  });
});

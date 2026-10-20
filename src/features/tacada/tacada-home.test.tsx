import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { roomState } from '@/test/tacada-fixtures';
import { TacadaHome } from './tacada-home';

const push = vi.fn();
const createTacadaTable = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
let publicRooms: unknown = [];
vi.mock('./connection', () => ({ createTacadaTable: (isPublic: boolean) => createTacadaTable(isPublic), usePublicTacadaTables: () => publicRooms }));
vi.mock('@/features/profile/profile-pill', () => ({ ProfilePill: () => null }));

describe('TacadaHome', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    publicRooms = [];
  });

  it('creates a private table and opens it', async () => {
    createTacadaTable.mockResolvedValue({ ok: true, data: { state: roomState({ code: 'QWE234' }), mySeat: 0 } });
    render(<TacadaHome />);
    await userEvent.click(screen.getByRole('radio', { name: /Privada/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Criar mesa' }));
    expect(createTacadaTable).toHaveBeenCalledWith(false);
    expect(push).toHaveBeenCalledWith('/tacada/QWE234');
  });

  it('joins by code', async () => {
    render(<TacadaHome />);
    await userEvent.type(screen.getByLabelText('Código da mesa'), 'abc234');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(push).toHaveBeenCalledWith('/tacada/ABC234');
  });

  it('lists public tables with their rules', () => {
    publicRooms = [{ code: 'ZXC234', hostNickname: 'Bia', hostCharacter: null, stake: 30, players: 1, rules: { shotSeconds: 45, aimGuide: 'short' } }];
    render(<TacadaHome />);
    const link = screen.getByRole('link', { name: /mesa de Bia, 1 de 2 jogadores/ });
    expect(link).toHaveAttribute('href', '/tacada/ZXC234');
    expect(screen.getByText('45 s por tacada')).toBeInTheDocument();
    expect(screen.getByText('Mira curta')).toBeInTheDocument();
  });
});

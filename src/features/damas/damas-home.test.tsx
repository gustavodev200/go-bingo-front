import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { roomState } from '@/test/damas-fixtures';
import { DamasHome } from './damas-home';

const push = vi.fn();
const createDamasTable = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
let publicRooms: unknown = [];
vi.mock('./connection', () => ({ createDamasTable: (isPublic: boolean) => createDamasTable(isPublic), usePublicDamasTables: () => publicRooms }));
vi.mock('@/features/profile/profile-pill', () => ({ ProfilePill: () => null }));

describe('DamasHome', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    publicRooms = [];
  });

  it('creates a private table and opens it', async () => {
    createDamasTable.mockResolvedValue({ ok: true, data: { state: roomState({ code: 'QWE234' }), mySeat: 0 } });
    render(<DamasHome />);
    await userEvent.click(screen.getByRole('radio', { name: /Privada/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Criar mesa' }));
    expect(createDamasTable).toHaveBeenCalledWith(false);
    expect(push).toHaveBeenCalledWith('/damas/QWE234');
  });

  it('joins by code', async () => {
    render(<DamasHome />);
    await userEvent.type(screen.getByLabelText('Código da mesa'), 'abc234');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(push).toHaveBeenCalledWith('/damas/ABC234');
  });

  it('lists public tables with their time per move', () => {
    publicRooms = [{ code: 'ZXC234', hostNickname: 'Bia', hostCharacter: null, stake: 30, players: 1, rules: { turnSeconds: 120 } }];
    render(<DamasHome />);
    const link = screen.getByRole('link', { name: /mesa de Bia, 1 de 2 jogadores/ });
    expect(link).toHaveAttribute('href', '/damas/ZXC234');
    expect(screen.getByText('2 min por lance')).toBeInTheDocument();
  });
});

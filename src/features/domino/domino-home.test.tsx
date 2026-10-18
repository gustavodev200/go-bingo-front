import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { roomState } from '@/test/domino-fixtures';
import { DominoHome } from './domino-home';

const push = vi.fn();
const createDominoTable = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
let publicRooms: unknown = [];
vi.mock('./connection', () => ({ createDominoTable: (isPublic: boolean) => createDominoTable(isPublic), usePublicDominoTables: () => publicRooms }));
vi.mock('@/features/profile/profile-pill', () => ({ ProfilePill: () => null }));

describe('DominoHome', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    publicRooms = [];
  });

  it('creates a private table and opens it', async () => {
    createDominoTable.mockResolvedValue({ ok: true, data: { state: roomState({ code: 'QWE234' }), mySeat: 0, hand: null } });
    render(<DominoHome />);
    await userEvent.click(screen.getByRole('radio', { name: /Privada/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Criar mesa' }));
    expect(createDominoTable).toHaveBeenCalledWith(false);
    expect(push).toHaveBeenCalledWith('/domino/QWE234');
  });

  it('joins by code', async () => {
    render(<DominoHome />);
    await userEvent.type(screen.getByLabelText('Código da mesa'), 'abc234');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(push).toHaveBeenCalledWith('/domino/ABC234');
  });

  it('lists public tables with their mode', () => {
    publicRooms = [{ code: 'ZXC234', hostNickname: 'Bia', hostCharacter: null, players: 3, rules: { target: 50, teams: true } }];
    render(<DominoHome />);
    const link = screen.getByRole('link', { name: /mesa de Bia, 3 de 4 jogadores/ });
    expect(link).toHaveAttribute('href', '/domino/ZXC234');
    expect(screen.getByText('Até 50 pontos')).toBeInTheDocument();
    expect(screen.getByText('Duplas')).toBeInTheDocument();
  });
});

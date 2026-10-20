import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { roomState } from '@/test/blackjack-fixtures';
import { BjHome } from './blackjack-home';

const push = vi.fn();
const createBjTable = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
let publicRooms: unknown = [];
vi.mock('./connection', () => ({ createBjTable: (isPublic: boolean) => createBjTable(isPublic), usePublicBjTables: () => publicRooms }));
vi.mock('@/features/profile/profile-pill', () => ({ ProfilePill: () => null }));

describe('BjHome', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    publicRooms = [];
  });

  it('creates a private table and opens it', async () => {
    createBjTable.mockResolvedValue({ ok: true, data: { state: roomState({ code: 'QWE234' }), mySeat: 0 } });
    render(<BjHome />);
    await userEvent.click(screen.getByRole('radio', { name: /Privada/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Criar mesa' }));
    expect(createBjTable).toHaveBeenCalledWith(false);
    expect(push).toHaveBeenCalledWith('/blackjack/QWE234');
  });

  it('joins by code', async () => {
    render(<BjHome />);
    await userEvent.type(screen.getByLabelText('Código da mesa'), 'abc234');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(push).toHaveBeenCalledWith('/blackjack/ABC234');
  });

  it('lists public tables with their rules', () => {
    publicRooms = [{ code: 'ZXC234', hostNickname: 'Bia', hostCharacter: null, stake: 30, players: 2, rules: { rounds: 15, payout: '6:5', decks: 2, turnSeconds: 30 } }];
    render(<BjHome />);
    const link = screen.getByRole('link', { name: /mesa de Bia, 2 de 5 jogadores/ });
    expect(link).toHaveAttribute('href', '/blackjack/ZXC234');
    expect(screen.getByText('15 rodadas · paga 6:5 · 2 baralhos')).toBeInTheDocument();
  });
});

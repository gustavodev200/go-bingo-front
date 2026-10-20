import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { roomState, seatPlayer } from '@/test/gauderio-fixtures';
import { GauderioHome } from './gauderio-home';
import { RoomLobby } from './room-lobby';
import { gaudActions } from '@/test/gauderio-fixtures';

const push = vi.fn();
const createTable = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
let publicRooms: unknown = [];
vi.mock('./connection', () => ({ createTable: (isPublic: boolean, settings: unknown) => createTable(isPublic, settings), usePublicTables: () => publicRooms }));
vi.mock('@/features/profile/profile-pill', () => ({ ProfilePill: () => null }));
vi.mock('@/features/arena/stake-picker', () => ({ StakePicker: () => null }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

describe('GauderioHome', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    publicRooms = [];
  });

  it('cria uma mesa com as regras escolhidas e abre', async () => {
    createTable.mockResolvedValue({ ok: true, data: { state: roomState({ code: 'QWE234' }), mySeat: 0, hand: null } });
    render(<GauderioHome />);
    await userEvent.click(screen.getByLabelText(/Duplas/));
    await userEvent.click(screen.getByLabelText(/Até 24/));
    await userEvent.click(screen.getByLabelText(/Sem flor/));
    await userEvent.click(screen.getByLabelText(/Privada/));
    await userEvent.click(screen.getByRole('button', { name: 'Criar mesa' }));
    expect(createTable).toHaveBeenCalledWith(false, { size: 4, target: 24, flor: false });
    expect(push).toHaveBeenCalledWith('/gauderio/QWE234');
  });

  it('mostra o erro e valida o código', async () => {
    createTable.mockResolvedValue({ ok: false, error: { code: 'INVALID_STATE', message: 'Você já está na mesa ABC234' } });
    render(<GauderioHome />);
    await userEvent.click(screen.getByRole('button', { name: 'Criar mesa' }));
    expect(screen.getByRole('alert')).toHaveTextContent('ABC234');
    await userEvent.type(screen.getByLabelText('Código da mesa'), 'abc');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(screen.getByRole('alert')).toHaveTextContent('6 letras');
    await userEvent.clear(screen.getByLabelText('Código da mesa'));
    await userEvent.type(screen.getByLabelText('Código da mesa'), 'abc234');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(push).toHaveBeenCalledWith('/gauderio/ABC234');
  });

  it('lista mesas públicas', () => {
    publicRooms = [{ code: 'ZXC234', hostNickname: 'Bia', hostCharacter: null, stake: 40, players: 1, settings: { size: 2, target: 12, flor: true } }];
    render(<GauderioHome />);
    expect(screen.getByRole('link', { name: /Entrar na mesa de Bia, Mano a mano · até 12 · com flor, 1 de 2/ })).toHaveAttribute('href', '/gauderio/ZXC234');
  });
});

describe('RoomLobby (Truco Gaudério)', () => {
  const lobby = (over = {}) => roomState({ phase: 'LOBBY', lobbyStatus: 'WAITING_PLAYERS', match: null, seats: [seatPlayer(0), null, null, null], ...over });

  it('o anfitrião troca as regras, fica pronto e senta em outro lugar', async () => {
    const a = gaudActions();
    render(<RoomLobby state={lobby()} mySeat={0} actions={a} />);
    expect(screen.getByText('1/2 na mesa')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: 'Duplas (4)' }));
    expect(a.setSettings).toHaveBeenCalledWith({ size: 4, target: 12, flor: true });
    await userEvent.click(screen.getByRole('radio', { name: 'Sem flor' }));
    expect(a.setSettings).toHaveBeenCalledWith({ size: 2, target: 12, flor: false });
    await userEvent.click(screen.getByRole('button', { name: 'Estou pronto!' }));
    expect(a.ready).toHaveBeenCalledWith(true);
    await userEvent.click(screen.getByRole('button', { name: 'Sentar no lugar 2' }));
    expect(a.takeSeat).toHaveBeenCalledWith(1);
    expect(screen.getByRole('button', { name: 'Começar partida' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Tornar privada' }));
    expect(a.setVisibility).toHaveBeenCalledWith(false);
  });

  it('quem não é anfitrião só vê as regras', () => {
    const a = gaudActions();
    render(<RoomLobby state={lobby({ seats: [seatPlayer(0), seatPlayer(1), null, null], lobbyStatus: 'READY_TO_START' })} mySeat={1} actions={a} />);
    expect(screen.getByRole('radio', { name: 'Duplas (4)' })).toBeDisabled();
    expect(screen.getByText('Tudo pronto! Esperando o anfitrião começar.')).toBeInTheDocument();
  });
});

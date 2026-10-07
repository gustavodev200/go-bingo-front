import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CreateRoomForm } from './create-room-form';

const apiFetch = vi.fn();
const push = vi.fn();
vi.mock('@/lib/api', async (orig) => ({ ...(await orig<typeof import('@/lib/api')>()), apiFetch: (...a: unknown[]) => apiFetch(...a) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

describe('CreateRoomForm', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates with defaults (15 players, public) and opens the room', async () => {
    apiFetch.mockResolvedValue({ code: 'ABC234' });
    render(<CreateRoomForm />);
    await userEvent.type(screen.getByLabelText(/nome da sala/i), 'Amigos');
    await userEvent.click(screen.getByRole('button', { name: /criar sala/i }));
    expect(apiFetch).toHaveBeenCalledWith('/rooms', expect.anything(), {
      method: 'POST',
      body: JSON.stringify({ name: 'Amigos', maxPlayers: 15, isPublic: true, winPattern: 'FULL_CARD' }),
    });
    expect(push).toHaveBeenCalledWith('/ABC234');
  });

  it('sends private rooms with the chosen size', async () => {
    apiFetch.mockResolvedValue({ code: 'ZZZ234' });
    render(<CreateRoomForm />);
    await userEvent.type(screen.getByLabelText(/nome da sala/i), 'Família');
    await userEvent.selectOptions(screen.getByLabelText(/máximo de jogadores/i), '25');
    await userEvent.click(screen.getByLabelText(/privada/i));
    await userEvent.click(screen.getByRole('button', { name: /criar sala/i }));
    expect(apiFetch.mock.calls[0][2].body).toBe(JSON.stringify({ name: 'Família', maxPlayers: 25, isPublic: false, winPattern: 'FULL_CARD' }));
  });

  it('lets the host pick the pace of the balls (Normal = server default, not sent)', async () => {
    apiFetch.mockResolvedValue({ code: 'ZZZ234' });
    render(<CreateRoomForm />);
    await userEvent.type(screen.getByLabelText(/nome da sala/i), 'Calma');
    await userEvent.click(screen.getByLabelText(/calmo/i));
    await userEvent.click(screen.getByRole('button', { name: /criar sala/i }));
    expect(JSON.parse(apiFetch.mock.calls[0][2].body as string)).toMatchObject({ drawIntervalMs: 12_000 });
  });

  it('lets the host pick Quina, showing each mode prize', async () => {
    apiFetch.mockResolvedValue({ code: 'ZZZ234' });
    render(<CreateRoomForm />);
    expect(screen.getByText(/prêmio 200/i)).toBeInTheDocument();
    expect(screen.getByText(/prêmio 100/i)).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/nome da sala/i), 'Rapidinha');
    await userEvent.click(screen.getByLabelText(/quina/i));
    await userEvent.click(screen.getByRole('button', { name: /criar sala/i }));
    expect(JSON.parse(apiFetch.mock.calls[0][2].body as string)).toMatchObject({ winPattern: 'LINE' });
  });

  it('validates the name length', async () => {
    render(<CreateRoomForm />);
    await userEvent.type(screen.getByLabelText(/nome da sala/i), 'ab');
    await userEvent.click(screen.getByRole('button', { name: /criar sala/i }));
    expect(screen.getByRole('alert')).toHaveTextContent(/mínimo 3/i);
    expect(apiFetch).not.toHaveBeenCalled();
  });
});

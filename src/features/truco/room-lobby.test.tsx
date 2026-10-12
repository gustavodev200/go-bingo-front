import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Seat, TrucoRoomState } from '@/contracts';
import { roomState, seatPlayer } from '@/test/truco-fixtures';
import type { TrucoActions } from './connection';
import { RoomLobby } from './room-lobby';
import { DEFAULT_CONVENTIONS } from './signals';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function actions(): TrucoActions {
  const ok = () => vi.fn(async () => true);
  return { leave: ok(), ready: ok(), takeSeat: ok(), start: ok(), rematch: ok(), playCard: ok(), requestBet: ok(), respondBet: ok(), decideTen: ok(), signal: ok() };
}

const lobby = (seats: TrucoRoomState['seats'], over = {}) => roomState({ phase: 'LOBBY', lobbyStatus: 'WAITING_PLAYERS', match: null, seats, ...over });

function renderLobby(state = lobby([seatPlayer(0), seatPlayer(1), null, null]), mySeat: Seat = 0) {
  const a = actions();
  render(<RoomLobby state={state} mySeat={mySeat} actions={a} conventions={DEFAULT_CONVENTIONS} setConventions={vi.fn()} />);
  return a;
}

describe('RoomLobby', () => {
  it('shows the code, the four seats and who is missing', () => {
    renderLobby();
    expect(screen.getByRole('button', { name: 'Copiar código ABC234' })).toBeInTheDocument();
    expect(screen.getByText('2/4 na mesa')).toBeInTheDocument();
    const seats = screen.getByRole('list');
    expect(within(seats).getAllByRole('listitem')).toHaveLength(4);
    expect(screen.getAllByText(/vago/)).toHaveLength(2);
    expect(screen.getByText('(você)')).toBeInTheDocument();
  });

  it('keeps start disabled until four players are ready', () => {
    renderLobby();
    expect(screen.getByRole('button', { name: 'Começar partida' })).toBeDisabled();
  });

  it('lets the host start when everybody is ready', async () => {
    const all = ([0, 1, 2, 3] as Seat[]).map((s) => seatPlayer(s, { ready: true }));
    const a = renderLobby(lobby(all, { lobbyStatus: 'READY_TO_START' }));
    await userEvent.click(screen.getByRole('button', { name: 'Começar partida' }));
    expect(a.start).toHaveBeenCalled();
  });

  it('non-hosts toggle ready, take a free seat or leave', async () => {
    const a = renderLobby(undefined, 1);
    expect(screen.queryByRole('button', { name: 'Começar partida' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Estou pronto!' }));
    expect(a.ready).toHaveBeenCalledWith(true);
    await userEvent.click(screen.getByRole('button', { name: 'Sentar no lugar 4' }));
    expect(a.takeSeat).toHaveBeenCalledWith(3);
    await userEvent.click(screen.getByRole('button', { name: /Sair da mesa/ }));
    expect(a.leave).toHaveBeenCalled();
  });

  it('opens the secret signal conventions without leaving the room', async () => {
    renderLobby();
    await userEvent.click(screen.getByRole('button', { name: /Sinais secretos/ }));
    expect(await screen.findByRole('dialog', { name: 'Sinais secretos' })).toBeInTheDocument();
    expect(screen.getAllByRole('combobox')).toHaveLength(6);
  });
});

describe('RoomLobby columns', () => {
  it('puts my partner under me and the opponents on the right, whatever my seat', () => {
    renderLobby(lobby([seatPlayer(0), seatPlayer(1), seatPlayer(2), seatPlayer(3)]), 1);
    const names = within(screen.getByRole('list')).getAllByRole('listitem').map((li) => li.getAttribute('aria-label'));
    expect(names).toEqual(['Bia', 'Caio', 'Duda', 'Ana']);
  });
});

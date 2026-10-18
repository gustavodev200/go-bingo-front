import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { DominoRoomState } from '@/contracts';
import { dominoActions } from '@/test/domino-actions';
import { roomState, seatPlayer } from '@/test/domino-fixtures';
import { RoomLobby } from './room-lobby';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const lobby = (over: Partial<DominoRoomState> = {}) => roomState({ phase: 'LOBBY', lobbyStatus: 'WAITING_PLAYERS', round: null, seats: [seatPlayer(0), seatPlayer(1), null, null], ...over });

function renderLobby(state = lobby(), mySeat = 0) {
  const a = dominoActions();
  render(<RoomLobby state={state} mySeat={mySeat} actions={a} />);
  return a;
}

describe('RoomLobby', () => {
  it('shows the code, the four seats and who is at the table', () => {
    renderLobby();
    expect(screen.getByText('ABC234')).toBeInTheDocument();
    expect(screen.getByText('2/4 na mesa')).toBeInTheDocument();
    expect(screen.getAllByText('Lugar vago')).toHaveLength(2);
    expect(screen.getByText('Bia')).toBeInTheDocument();
  });

  it('lets the host pick the mode and teams', async () => {
    const a = renderLobby();
    await userEvent.click(screen.getByRole('radio', { name: /Até 100 pontos/ }));
    expect(a.setRules).toHaveBeenCalledWith({ target: 100, teams: false });
    await userEvent.click(screen.getByRole('checkbox', { name: /Duplas/ }));
    expect(a.setRules).toHaveBeenCalledWith({ target: 0, teams: true });
  });

  it('shows the rules read-only to the other players', () => {
    renderLobby(lobby(), 1);
    expect(screen.getByRole('radio', { name: /Rodada única/ })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: /Duplas/ })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Começar partida' })).not.toBeInTheDocument();
  });

  it('tells the host that teams need 4 players', () => {
    renderLobby(lobby({ rules: { target: 0, teams: true } }));
    expect(screen.getByText(/Em duplas a partida começa com 4 jogadores/)).toBeInTheDocument();
  });

  it('starts when everybody is ready', async () => {
    const a = renderLobby(lobby({ lobbyStatus: 'READY_TO_START' }));
    await userEvent.click(screen.getByRole('button', { name: 'Começar partida' }));
    expect(a.start).toHaveBeenCalled();
  });
});

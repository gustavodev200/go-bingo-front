import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { UnoRoomState } from '@/contracts';
import { unoActions } from '@/test/uno-actions';
import { roomState, seatPlayer } from '@/test/uno-fixtures';
import { RoomLobby } from './room-lobby';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const lobby = (over: Partial<UnoRoomState> = {}) => roomState({ phase: 'LOBBY', lobbyStatus: 'WAITING_PLAYERS', round: null, seats: [seatPlayer(0), seatPlayer(1), null, null, null, null], ...over });

function renderLobby(state = lobby(), mySeat = 0) {
  const a = unoActions();
  render(<RoomLobby state={state} mySeat={mySeat} actions={a} />);
  return a;
}

describe('RoomLobby', () => {
  it('shows the code, the six seats and who is at the table', () => {
    renderLobby();
    expect(screen.getByText('ABC234')).toBeInTheDocument();
    expect(screen.getByText('2/6 na mesa')).toBeInTheDocument();
    expect(screen.getAllByText('Lugar vago')).toHaveLength(4);
    expect(screen.getByText('Bia')).toBeInTheDocument();
  });

  it('lets the host pick the mode and the house rules', async () => {
    const a = renderLobby();
    await userEvent.click(screen.getByRole('radio', { name: /Corrida dos 200/ }));
    expect(a.setRules).toHaveBeenCalledWith({ target: 200, stacking: false, sevenZero: false });
    await userEvent.click(screen.getByRole('checkbox', { name: /Empilhar/ }));
    expect(a.setRules).toHaveBeenCalledWith({ target: 0, stacking: true, sevenZero: false });
  });

  it('shows the rules read-only to the other players', () => {
    renderLobby(lobby(), 1);
    expect(screen.getByRole('radio', { name: /Rodada única/ })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: /7-0/ })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Começar partida' })).not.toBeInTheDocument();
  });

  it('starts only when everybody is ready', async () => {
    const a = renderLobby();
    expect(screen.getByRole('button', { name: 'Começar partida' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Estou pronto!' }));
    expect(a.ready).toHaveBeenCalledWith(true);
  });

  it('enables the start for the host when ready', async () => {
    const a = renderLobby(lobby({ lobbyStatus: 'READY_TO_START' }));
    await userEvent.click(screen.getByRole('button', { name: 'Começar partida' }));
    expect(a.start).toHaveBeenCalled();
  });
});

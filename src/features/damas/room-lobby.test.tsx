import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { DamasRoomState } from '@/contracts';
import { damasActions } from '@/test/damas-actions';
import { roomState, seatPlayer } from '@/test/damas-fixtures';
import { RoomLobby } from './room-lobby';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const lobby = (over: Partial<DamasRoomState> = {}) => roomState({ phase: 'LOBBY', lobbyStatus: 'WAITING_PLAYERS', game: null, seats: [seatPlayer(0), null], ...over });

function renderLobby(state = lobby(), mySeat = 0) {
  const a = damasActions();
  render(<RoomLobby state={state} mySeat={mySeat} actions={a} />);
  return a;
}

describe('RoomLobby', () => {
  it('shows the code and waits for an opponent', () => {
    renderLobby();
    expect(screen.getByText('ABC234')).toBeInTheDocument();
    expect(screen.getByText('1/2 na mesa')).toBeInTheDocument();
    expect(screen.getByText('Esperando adversário')).toBeInTheDocument();
  });

  it('lets the host pick the time per move', async () => {
    const a = renderLobby();
    await userEvent.click(screen.getByRole('radio', { name: /30 s/ }));
    expect(a.setRules).toHaveBeenCalledWith({ turnSeconds: 30 });
  });

  it('shows the rules read-only to the guest', () => {
    renderLobby(lobby({ seats: [seatPlayer(0), seatPlayer(1)] }), 1);
    expect(screen.getByRole('radio', { name: /2 min/ })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Começar partida' })).not.toBeInTheDocument();
  });

  it('starts when both are ready', async () => {
    const a = renderLobby(lobby({ seats: [seatPlayer(0, { ready: true }), seatPlayer(1, { ready: true })], lobbyStatus: 'READY_TO_START' }));
    await userEvent.click(screen.getByRole('button', { name: 'Começar partida' }));
    expect(a.start).toHaveBeenCalled();
  });
});

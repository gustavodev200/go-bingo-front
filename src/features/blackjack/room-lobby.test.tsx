import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { BjRoomState } from '@/contracts';
import { bjActions } from '@/test/blackjack-actions';
import { roomState, seatPlayer } from '@/test/blackjack-fixtures';
import { RoomLobby } from './room-lobby';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const lobby = (over: Partial<BjRoomState> = {}) => roomState({ phase: 'LOBBY', lobbyStatus: 'WAITING_PLAYERS', game: null, seats: [seatPlayer(0), null, null, null, null], ...over });

function renderLobby(state = lobby(), mySeat = 0) {
  const a = bjActions();
  render(<RoomLobby state={state} mySeat={mySeat} actions={a} />);
  return a;
}

describe('RoomLobby', () => {
  it('shows the code and the free seats', () => {
    renderLobby();
    expect(screen.getByText('ABC234')).toBeInTheDocument();
    expect(screen.getByText('1/5 na mesa')).toBeInTheDocument();
    expect(screen.getAllByText('Lugar livre')).toHaveLength(4);
  });

  it('lets the host pick the rules', async () => {
    const a = renderLobby();
    await userEvent.click(screen.getByRole('radio', { name: /^15\s*Longa/ }));
    expect(a.setRules).toHaveBeenCalledWith({ rounds: 15, payout: '3:2', decks: 6, turnSeconds: 15 });
    await userEvent.click(screen.getByRole('radio', { name: /6 para 5/ }));
    expect(a.setRules).toHaveBeenCalledWith(expect.objectContaining({ payout: '6:5' }));
  });

  it('shows the rules read-only to a guest', () => {
    renderLobby(lobby({ seats: [seatPlayer(0), seatPlayer(1), null, null, null] }), 1);
    expect(screen.getByRole('radio', { name: /2 baralhos/ })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Começar partida' })).not.toBeInTheDocument();
  });

  it('offers a solo practice to a lone host', async () => {
    const a = renderLobby(lobby({ seats: [seatPlayer(0, { ready: true }), null, null, null, null], lobbyStatus: 'READY_TO_START' }));
    await userEvent.click(screen.getByRole('button', { name: 'Treinar contra o dealer' }));
    expect(a.start).toHaveBeenCalled();
  });

  it('starts when everybody is ready', async () => {
    const a = renderLobby(lobby({ seats: [seatPlayer(0, { ready: true }), seatPlayer(1, { ready: true }), null, null, null], lobbyStatus: 'READY_TO_START' }));
    await userEvent.click(screen.getByRole('button', { name: 'Começar partida' }));
    expect(a.start).toHaveBeenCalled();
  });
});

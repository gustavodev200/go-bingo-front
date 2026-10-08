import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Member, RoomSnapshot } from '@/contracts';
import { LobbyView } from './lobby-view';
import { initialGameState, reduce, useGameStore } from './store';

const ME = '00000000-0000-4000-8000-000000000001';
const ANA = '00000000-0000-4000-8000-000000000002';
const grid = Array.from({ length: 25 }, (_, i) => (i === 12 ? 0 : i + 1));
const actions = { generateCard: vi.fn(), start: vi.fn(), cancel: vi.fn(), leave: vi.fn(), kick: vi.fn(), mark: vi.fn(), claim: vi.fn(), replay: vi.fn(), emote: vi.fn() };

function member(userId: string, nickname: string, slot: number, extra: Partial<Member> = {}): Member {
  return { userId, nickname, character: null, slot, isGuest: false, connected: true, hasCard: false, ...extra };
}

function load(overrides: Partial<RoomSnapshot>) {
  const snapshot: RoomSnapshot = {
    code: 'ABC234', name: 'Amigos', hostId: ME, maxPlayers: 10, isPublic: true, status: 'WAITING', winPattern: 'FULL_CARD',
    members: [member(ME, 'Eu', 0), member(ANA, 'Ana', 1)], myCard: null, game: null,
    ...overrides,
  };
  useGameStore.setState(reduce(initialGameState(ME), { event: 'room:state', payload: snapshot }));
}

describe('LobbyView', () => {
  beforeEach(() => vi.clearAllMocks());

  it('host waits for 2 ready players before starting', () => {
    load({ members: [member(ME, 'Eu', 0, { hasCard: true }), member(ANA, 'Ana', 1)] });
    render(<LobbyView actions={actions} coins={100} onLeave={vi.fn()} />);
    expect(screen.getByRole('button', { name: /aguardando 2 jogadores prontos/i })).toBeDisabled();
    expect(screen.getByText('2/10 jogadores · 1 prontos')).toBeInTheDocument();
  });

  it('shows the win mode chosen by the host', () => {
    load({ winPattern: 'LINE' });
    render(<LobbyView actions={actions} coins={100} onLeave={vi.fn()} />);
    expect(screen.getByText('Quina')).toBeInTheDocument();
  });

  it('host starts, kicks and cancels', async () => {
    load({ members: [member(ME, 'Eu', 0, { hasCard: true }), member(ANA, 'Ana', 1, { hasCard: true })], myCard: { id: '00000000-0000-4000-8000-0000000000aa', grid, marked: [] } });
    render(<LobbyView actions={actions} coins={100} onLeave={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /iniciar partida/i }));
    expect(actions.start).toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: /remover/i }));
    expect(actions.kick).toHaveBeenCalledWith(ANA);
    await userEvent.click(screen.getByRole('button', { name: /cancelar sala/i }));
    expect(actions.cancel).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /trocar cartela/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /casa livre/i })).toBeInTheDocument();
  });

  it('shows the balance and the card cost; blocks the card without coins', async () => {
    load({});
    const { rerender } = render(<LobbyView actions={actions} coins={100} onLeave={vi.fn()} />);
    expect(screen.getByRole('button', { name: /gerar cartela, custa 5 moedas/i })).toBeEnabled();
    expect(screen.getByText('100')).toBeInTheDocument();
    rerender(<LobbyView actions={actions} coins={4} onLeave={vi.fn()} />);
    expect(screen.getByRole('button', { name: /gerar cartela/i })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent(/sem moedas para trocar/i);
  });

  it('players generate a card, see who is offline and can leave', async () => {
    const onLeave = vi.fn();
    load({ hostId: ANA, members: [member(ME, 'Eu', 0), member(ANA, 'Ana', 1, { connected: false })] });
    render(<LobbyView actions={actions} coins={100} onLeave={onLeave} />);
    expect(screen.queryByRole('button', { name: /iniciar partida/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /remover/i })).not.toBeInTheDocument();
    expect(screen.getByText(/ana · reconectando/i)).toBeInTheDocument();
    expect(screen.getByText(/eu \(você\)/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /gerar cartela/i }));
    expect(actions.generateCard).toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: /sair da sala/i }));
    expect(onLeave).toHaveBeenCalled();
  });

  it('without coins, explains the player still plays with a free card', () => {
    render(<LobbyView actions={actions} coins={0} onLeave={vi.fn()} />);
    expect(screen.getByRole('status')).toHaveTextContent(/você ainda joga/i);
    expect(screen.getByRole('status')).toHaveTextContent(/de graça/i);
  });
});

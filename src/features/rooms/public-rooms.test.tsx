import { act, render, screen } from '@testing-library/react';
import { FakeSocket, flush } from '@/test/fake-socket';
import { PublicRooms } from './public-rooms';

let socket: FakeSocket;
vi.mock('@/lib/socket', async (orig) => ({ ...(await orig<typeof import('@/lib/socket')>()), createGameSocket: () => socket.asSocket() }));

const room = { code: 'ABC234', name: 'Amigos', playerCount: 2, maxPlayers: 10, status: 'WAITING' as const };

describe('PublicRooms', () => {
  beforeEach(() => {
    socket = new FakeSocket();
  });

  it('loads the list on connect and follows live updates', async () => {
    socket.acks.set('rooms:watch', { ok: true, data: [] });
    const { unmount } = render(<PublicRooms />);
    expect(screen.getByText(/carregando salas/i)).toBeInTheDocument();

    await act(async () => {
      socket.fire('connect');
      await flush();
    });
    expect(screen.getByText(/nenhuma sala pública/i)).toBeInTheDocument();

    act(() => socket.fire('rooms:updated', { rooms: [room] }));
    expect(screen.getByRole('link', { name: /amigos/i })).toHaveAttribute('href', '/ABC234');
    expect(screen.getByText('2/10 · #ABC234')).toBeInTheDocument();

    unmount();
    expect(socket.connected).toBe(false);
  });

  it('keeps loading when the watch ack fails', async () => {
    render(<PublicRooms />);
    await act(async () => {
      socket.fire('connect');
      await flush();
    });
    expect(screen.getByText(/carregando salas/i)).toBeInTheDocument();
  });
});

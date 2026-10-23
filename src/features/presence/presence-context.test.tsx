import { act, render, screen } from '@testing-library/react';
import { PresenceProvider, useOnlineCount } from './presence-context';

type Handler = (payload?: unknown) => void;
const handlers = new Map<string, Handler>();
const socket = {
  on: vi.fn((event: string, fn: Handler) => handlers.set(event, fn)),
  connect: vi.fn(),
  disconnect: vi.fn(),
  removeAllListeners: vi.fn(),
};
const createSocket = vi.fn<(namespace: string) => typeof socket>(() => socket);
vi.mock('@/lib/socket', () => ({ createSocket: (namespace: string) => createSocket(namespace) }));

function Probe() {
  const online = useOnlineCount();
  return <p>{online === null ? 'sem dado' : `${online} online`}</p>;
}

describe('PresenceProvider', () => {
  beforeEach(() => {
    handlers.clear();
    vi.clearAllMocks();
  });

  it('connects to /presence and exposes the pushed count', () => {
    render(
      <PresenceProvider>
        <Probe />
      </PresenceProvider>,
    );
    expect(createSocket).toHaveBeenCalledWith('/presence');
    expect(socket.connect).toHaveBeenCalled();
    expect(screen.getByText('sem dado')).toBeInTheDocument();

    act(() => handlers.get('presence:count')?.({ online: 4 }));
    expect(screen.getByText('4 online')).toBeInTheDocument();

    act(() => handlers.get('presence:count')?.({ online: 'x' }));
    expect(screen.getByText('4 online')).toBeInTheDocument();

    act(() => handlers.get('disconnect')?.());
    expect(screen.getByText('sem dado')).toBeInTheDocument();
  });

  it('closes the socket on unmount', () => {
    const { unmount } = render(<PresenceProvider>x</PresenceProvider>);
    unmount();
    expect(socket.removeAllListeners).toHaveBeenCalled();
    expect(socket.disconnect).toHaveBeenCalled();
  });

  it('is null outside the provider', () => {
    render(<Probe />);
    expect(screen.getByText('sem dado')).toBeInTheDocument();
  });
});

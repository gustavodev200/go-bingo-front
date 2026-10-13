import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FakeSocket } from '@/test/fake-socket';
import { useVoiceChat } from './use-voice-chat';
import { VoiceChatPanel } from './voice-chat';
import type { VoiceDeps } from './voice-engine';

const supported = vi.hoisted(() => ({ value: true }));
vi.mock('./browser-deps', () => ({ voiceSupported: () => supported.value, browserVoiceDeps: vi.fn() }));
const toast = vi.hoisted(() => vi.fn());
vi.mock('sonner', () => ({ toast }));

const ana = { peerId: 'p-ana', userId: 'u-ana', nickname: 'Ana', muted: true };

function makeDeps(socket: FakeSocket, micDenied = false): VoiceDeps {
  const track = { kind: 'audio', enabled: true, stop: vi.fn() };
  const mic = { getAudioTracks: () => [track], getTracks: () => [track] } as unknown as MediaStream;
  return {
    socket: socket.asSocket(),
    getUserMedia: () => (micDenied ? Promise.reject(new Error('no')) : Promise.resolve(mic)),
    createPeerConnection: () =>
      ({
        connectionState: 'new',
        addTransceiver: vi.fn(),
        createOffer: () => new Promise(() => undefined),
        close: vi.fn(),
      }) as unknown as RTCPeerConnection,
    play: () => () => undefined,
    meter: () => null,
  };
}

function Harness({ deps }: { deps: () => VoiceDeps }) {
  return <VoiceChatPanel voice={useVoiceChat('truco', 'ABCDEF', deps)} />;
}

function newSocket() {
  const socket = new FakeSocket();
  socket.connected = true;
  socket.acks.set('voice:join', { ok: true, data: { peerId: 'me', peers: [ana], iceServers: [] } });
  socket.acks.set('voice:mute', { ok: true, data: null });
  socket.acks.set('voice:leave', { ok: true, data: null });
  return socket;
}

describe('VoiceChat', () => {
  beforeEach(() => {
    supported.value = true;
    toast.mockReset();
  });

  it('hides itself where the browser has no WebRTC', () => {
    supported.value = false;
    const { container } = render(<Harness deps={() => makeDeps(newSocket())} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('joins, mutes and leaves', async () => {
    const user = userEvent.setup();
    const socket = newSocket();
    render(<Harness deps={() => makeDeps(socket)} />);

    await user.click(screen.getByRole('button', { name: 'Entrar no chat de voz' }));
    expect(await screen.findByRole('region', { name: 'Chat de voz' })).toBeInTheDocument();
    expect(socket.emitted[0]).toEqual({ event: 'voice:join', payload: { game: 'truco', code: 'ABCDEF', muted: false } });
    expect(screen.getByText('AN')).toBeInTheDocument();
    expect(screen.getByText(/Ana: microfone desligado/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Desligar microfone' }));
    expect(screen.getByRole('button', { name: 'Ligar microfone' })).toHaveAttribute('aria-pressed', 'true');
    expect(socket.emitted.at(-1)).toEqual({ event: 'voice:mute', payload: { muted: true } });

    await user.click(screen.getByRole('button', { name: 'Sair do chat de voz' }));
    expect(screen.getByRole('button', { name: 'Entrar no chat de voz' })).toBeInTheDocument();
    expect(socket.emitted.some((e) => e.event === 'voice:leave')).toBe(true);
  });

  it('listens only without a microphone and shows when alone', async () => {
    const user = userEvent.setup();
    const socket = newSocket();
    socket.acks.set('voice:join', { ok: true, data: { peerId: 'me', peers: [], iceServers: [] } });
    render(<Harness deps={() => makeDeps(socket, true)} />);
    await user.click(screen.getByRole('button', { name: 'Entrar no chat de voz' }));
    expect(await screen.findByText('Só você')).toBeInTheDocument();
    expect(screen.getByText('Só ouvindo, sem microfone')).toBeInTheDocument();
    expect(toast).toHaveBeenCalledWith('Sem acesso ao microfone: você vai só ouvir');
  });

  it('leaves the channel when the room screen goes away', async () => {
    const user = userEvent.setup();
    const socket = newSocket();
    const { unmount } = render(<Harness deps={() => makeDeps(socket)} />);
    await user.click(screen.getByRole('button', { name: 'Entrar no chat de voz' }));
    await screen.findByRole('region', { name: 'Chat de voz' });
    act(() => unmount());
    expect(socket.emitted.some((e) => e.event === 'voice:leave')).toBe(true);
    expect(socket.connected).toBe(false);
  });
});

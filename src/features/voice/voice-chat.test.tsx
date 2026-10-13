import { act, fireEvent, render, screen } from '@testing-library/react';
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

describe('VoiceChat dragging', () => {
  beforeEach(() => {
    supported.value = true;
    window.localStorage.clear();
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 416 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 816 });
  });

  const holder = () => screen.getByRole('button', { name: 'Entrar no chat de voz' }).parentElement!;

  it('starts at the left edge, a third of the way down', () => {
    render(<Harness deps={() => makeDeps(newSocket())} />);
    // jsdom has no layout: the element measures 0×0, so the free space is the screen minus the margins.
    expect(holder()).toHaveStyle({ left: '8px', top: `${8 + 0.33 * 800}px` });
  });

  it('moves with the pointer, remembers the spot and does not click', () => {
    const socket = newSocket();
    render(<Harness deps={() => makeDeps(socket)} />);
    const button = screen.getByRole('button', { name: 'Entrar no chat de voz' });
    // jsdom puts every element at 0,0: pressing there grabs it by its corner.
    fireEvent.pointerDown(button, { button: 0, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(window, { clientX: 208, clientY: 408 });
    fireEvent.pointerUp(window);
    fireEvent.click(button);
    expect(holder()).toHaveStyle({ left: '208px', top: '408px' });
    expect(JSON.parse(window.localStorage.getItem('voice-chat-position')!)).toEqual({ x: 0.5, y: 0.5 });
    expect(socket.emitted).toEqual([]);
  });

  it('keeps the spot inside the screen', () => {
    render(<Harness deps={() => makeDeps(newSocket())} />);
    fireEvent.pointerDown(holder(), { button: 0, clientX: 8, clientY: 272 });
    fireEvent.pointerMove(window, { clientX: 5000, clientY: -300 });
    fireEvent.pointerUp(window);
    expect(holder()).toHaveStyle({ left: '408px', top: '8px' });
  });

  it('treats a tiny wobble as a click', async () => {
    const socket = newSocket();
    render(<Harness deps={() => makeDeps(socket)} />);
    const button = screen.getByRole('button', { name: 'Entrar no chat de voz' });
    fireEvent.pointerDown(button, { button: 0, clientX: 8, clientY: 272 });
    fireEvent.pointerMove(window, { clientX: 10, clientY: 274 });
    fireEvent.pointerUp(window);
    fireEvent.click(button);
    expect(await screen.findByRole('region', { name: 'Chat de voz' })).toBeInTheDocument();
    expect(window.localStorage.getItem('voice-chat-position')).toBeNull();
  });

  it('restores a saved spot and ignores a broken one', () => {
    window.localStorage.setItem('voice-chat-position', JSON.stringify({ x: 1, y: 0 }));
    const { unmount } = render(<Harness deps={() => makeDeps(newSocket())} />);
    expect(holder()).toHaveStyle({ left: '408px', top: '8px' });
    unmount();
    window.localStorage.setItem('voice-chat-position', '{oops');
    render(<Harness deps={() => makeDeps(newSocket())} />);
    expect(holder()).toHaveStyle({ left: '8px' });
  });

  it('follows screen resizes', () => {
    window.localStorage.setItem('voice-chat-position', JSON.stringify({ x: 1, y: 1 }));
    render(<Harness deps={() => makeDeps(newSocket())} />);
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 816 });
    act(() => {
      window.dispatchEvent(new Event('resize'));
    });
    expect(holder()).toHaveStyle({ left: '808px' });
  });
});

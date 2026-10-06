import { FakeSocket } from '@/test/fake-socket';
import { createGameSocket, emitAck } from './socket';

const io = vi.fn<(...args: unknown[]) => FakeSocket>(() => new FakeSocket());
vi.mock('socket.io-client', () => ({ io: (...args: unknown[]) => io(...args) }));
vi.mock('./session', () => ({ getAccessToken: vi.fn(async () => 'tok-abc') }));

describe('createGameSocket', () => {
  it('connects lazily to the /game namespace over websocket', () => {
    createGameSocket();
    const [url, options] = io.mock.calls[0] as [string, { autoConnect: boolean; transports: string[] }];
    expect(url).toBe('http://api.test/game');
    expect(options.autoConnect).toBe(false);
    expect(options.transports).toEqual(['websocket']);
  });

  it('reads a fresh access token on every (re)connection', async () => {
    createGameSocket();
    const { auth } = io.mock.calls.at(-1)![1] as { auth: (cb: (data: object) => void) => void };
    const token = await new Promise((resolve) => auth(resolve));
    expect(token).toEqual({ token: 'tok-abc' });
  });
});

describe('emitAck', () => {
  it('returns the server ack', async () => {
    const socket = new FakeSocket();
    socket.acks.set('card:mark', { ok: true, data: { marked: [3] } });
    await expect(emitAck(socket.asSocket(), 'card:mark', { index: 3 })).resolves.toEqual({ ok: true, data: { marked: [3] } });
    expect(socket.emitted).toEqual([{ event: 'card:mark', payload: { index: 3 } }]);
  });

  it('turns a timeout into an error ack', async () => {
    const res = await emitAck(new FakeSocket().asSocket(), 'game:start');
    expect(res).toEqual({ ok: false, error: { code: 'INTERNAL', message: 'Sem resposta do servidor' } });
  });
});

import { FakeSocket, flush } from '@/test/fake-socket';
import { VoiceEngine, type VoiceDeps, type VoiceView } from './voice-engine';

const ICE = [{ urls: 'stun:example.org' }];
const ana = { peerId: 'p-ana', userId: 'u-ana', nickname: 'Ana', muted: false };
const bia = { peerId: 'p-bia', userId: 'u-bia', nickname: 'Bia', muted: true };

class FakeTrack {
  kind = 'audio';
  enabled = true;
  stop = vi.fn();
}

function fakeStream(track = new FakeTrack()) {
  return { track, getAudioTracks: () => [track], getTracks: () => [track] } as unknown as MediaStream & { track: FakeTrack };
}

class FakeSender {
  constructor(public track: unknown) {}
  replaceTrack = vi.fn(async (track: unknown) => {
    this.track = track;
  });
}

class FakePC {
  static all: FakePC[] = [];
  connectionState: RTCPeerConnectionState = 'new';
  remoteDescription: RTCSessionDescriptionInit | null = null;
  localDescription: RTCSessionDescriptionInit | null = null;
  transceivers: { receiver: { track: { kind: string } }; sender: FakeSender; direction: string }[] = [];
  candidates: RTCIceCandidateInit[] = [];
  onicecandidate: ((e: { candidate: unknown }) => void) | null = null;
  ontrack: ((e: { streams: MediaStream[]; track: unknown }) => void) | null = null;
  onconnectionstatechange: (() => void) | null = null;
  closed = false;
  restarted = false;
  constructor(public config: RTCConfiguration) {
    FakePC.all.push(this);
  }
  addTransceiver(trackOrKind: unknown, init: { direction: string }) {
    this.transceivers.push({ receiver: { track: { kind: 'audio' } }, sender: new FakeSender(typeof trackOrKind === 'string' ? null : trackOrKind), direction: init.direction });
  }
  getTransceivers() {
    return this.transceivers;
  }
  async createOffer(opts?: { iceRestart?: boolean }) {
    return { type: 'offer' as const, sdp: opts?.iceRestart ? 'offer-restart' : 'offer-sdp' };
  }
  async createAnswer() {
    return { type: 'answer' as const, sdp: 'answer-sdp' };
  }
  async setLocalDescription(d: RTCSessionDescriptionInit) {
    this.localDescription = d;
  }
  async setRemoteDescription(d: RTCSessionDescriptionInit) {
    this.remoteDescription = d;
    if (d.type === 'offer' && this.transceivers.length === 0) this.addTransceiver('audio', { direction: 'recvonly' });
  }
  async addIceCandidate(c: RTCIceCandidateInit) {
    this.candidates.push(c);
  }
  restartIce() {
    this.restarted = true;
  }
  close() {
    this.closed = true;
  }
  setState(state: RTCPeerConnectionState) {
    this.connectionState = state;
    this.onconnectionstatechange?.();
  }
}

function setup(opts: { micDenied?: boolean; joinAck?: unknown; levels?: Map<MediaStream, number> } = {}) {
  FakePC.all = [];
  const socket = new FakeSocket();
  socket.connected = true;
  socket.acks.set('voice:join', opts.joinAck ?? { ok: true, data: { peerId: 'me', peers: [], iceServers: ICE } });
  socket.acks.set('voice:signal', { ok: true, data: null });
  socket.acks.set('voice:mute', { ok: true, data: null });
  socket.acks.set('voice:leave', { ok: true, data: null });
  const mic = fakeStream();
  const levels = opts.levels ?? new Map<MediaStream, number>();
  const stopAudio = vi.fn();
  const deps: VoiceDeps = {
    socket: socket.asSocket(),
    getUserMedia: vi.fn(() => (opts.micDenied ? Promise.reject(new Error('denied')) : Promise.resolve(mic))),
    createPeerConnection: (config) => new FakePC(config) as unknown as RTCPeerConnection,
    play: vi.fn(() => stopAudio),
    meter: (stream) => ({ level: () => levels.get(stream) ?? 0, stop: vi.fn() }),
  };
  const views: VoiceView[] = [];
  const notices: string[] = [];
  const engine = new VoiceEngine('uno', 'ABCDEF', deps, { onChange: (v) => views.push(v), onNotice: (m) => notices.push(m) });
  const signals = () => socket.emitted.filter((e) => e.event === 'voice:signal').map((e) => e.payload);
  return { socket, mic, deps, engine, views, notices, levels, stopAudio, signals, last: () => views[views.length - 1] };
}

describe('VoiceEngine', () => {
  it('joins with the microphone and offers to everyone already in the channel', async () => {
    const t = setup({ joinAck: { ok: true, data: { peerId: 'me', peers: [ana, bia], iceServers: ICE } } });
    await t.engine.start();
    await flush();
    expect(t.socket.emitted[0]).toEqual({ event: 'voice:join', payload: { game: 'uno', code: 'ABCDEF', muted: false } });
    expect(FakePC.all).toHaveLength(2);
    expect(FakePC.all[0].config).toEqual({ iceServers: ICE });
    expect(FakePC.all[0].transceivers[0]).toMatchObject({ direction: 'sendrecv', sender: { track: t.mic.track } });
    expect(t.signals()).toEqual([
      { to: 'p-ana', data: { kind: 'offer', sdp: 'offer-sdp' } },
      { to: 'p-bia', data: { kind: 'offer', sdp: 'offer-sdp' } },
    ]);
    expect(t.last()).toMatchObject({ status: 'live', hasMic: true, muted: false, peers: [{ nickname: 'Ana' }, { nickname: 'Bia', muted: true }] });
  });

  it('queues ICE candidates until the answer arrives', async () => {
    const t = setup({ joinAck: { ok: true, data: { peerId: 'me', peers: [ana], iceServers: ICE } } });
    await t.engine.start();
    await flush();
    const pc = FakePC.all[0];
    const candidate = { kind: 'candidate', candidate: 'c1', sdpMid: '0', sdpMLineIndex: 0 };
    t.socket.fire('voice:signal', { from: 'p-ana', data: candidate });
    await flush();
    expect(pc.candidates).toEqual([]);
    t.socket.fire('voice:signal', { from: 'p-ana', data: { kind: 'answer', sdp: 'their-answer' } });
    await flush();
    expect(pc.remoteDescription).toEqual({ type: 'answer', sdp: 'their-answer' });
    expect(pc.candidates).toEqual([{ candidate: 'c1', sdpMid: '0', sdpMLineIndex: 0 }]);
    t.socket.fire('voice:signal', { from: 'p-ana', data: { ...candidate, candidate: 'c2' } });
    await flush();
    expect(pc.candidates).toHaveLength(2);
  });

  it('sends its own ICE candidates and plays the remote audio', async () => {
    const t = setup({ joinAck: { ok: true, data: { peerId: 'me', peers: [ana], iceServers: ICE } } });
    await t.engine.start();
    await flush();
    const pc = FakePC.all[0];
    pc.onicecandidate?.({ candidate: { candidate: 'mine', sdpMid: '0', sdpMLineIndex: 0 } });
    pc.onicecandidate?.({ candidate: null });
    expect(t.signals().at(-1)).toEqual({ to: 'p-ana', data: { kind: 'candidate', candidate: 'mine', sdpMid: '0', sdpMLineIndex: 0 } });
    const remote = fakeStream();
    pc.ontrack?.({ streams: [remote], track: remote.track });
    expect(t.deps.play).toHaveBeenCalledWith(remote);
    pc.setState('connected');
    expect(t.last().peers[0].connected).toBe(true);
  });

  it('answers a newcomer’s offer with its microphone', async () => {
    const t = setup();
    await t.engine.start();
    await flush();
    t.socket.fire('voice:peer_joined', bia);
    expect(t.last().peers).toMatchObject([{ peerId: 'p-bia', nickname: 'Bia' }]);
    t.socket.fire('voice:signal', { from: 'p-bia', data: { kind: 'offer', sdp: 'their-offer' } });
    await flush();
    const pc = FakePC.all[0];
    expect(pc.remoteDescription).toEqual({ type: 'offer', sdp: 'their-offer' });
    expect(pc.transceivers[0]).toMatchObject({ direction: 'sendrecv', sender: { track: t.mic.track } });
    expect(t.signals()).toEqual([{ to: 'p-bia', data: { kind: 'answer', sdp: 'answer-sdp' } }]);
  });

  it('accepts an offer that arrives before the newcomer is announced', async () => {
    const t = setup();
    await t.engine.start();
    await flush();
    t.socket.fire('voice:signal', { from: 'p-bia', data: { kind: 'offer', sdp: 'their-offer' } });
    await flush();
    t.socket.fire('voice:peer_joined', bia);
    expect(FakePC.all).toHaveLength(1);
    expect(FakePC.all[0].closed).toBe(false);
    expect(t.last().peers).toMatchObject([{ nickname: 'Bia' }]);
  });

  it('ignores answers and candidates from unknown peers', async () => {
    const t = setup();
    await t.engine.start();
    await flush();
    t.socket.fire('voice:signal', { from: 'ghost', data: { kind: 'answer', sdp: 'x' } });
    t.socket.fire('voice:signal', { from: 'ghost', data: { kind: 'candidate', candidate: 'c', sdpMid: null, sdpMLineIndex: null } });
    await flush();
    expect(FakePC.all).toHaveLength(0);
  });

  it('listens only when the microphone is denied', async () => {
    const t = setup({ micDenied: true, joinAck: { ok: true, data: { peerId: 'me', peers: [ana], iceServers: ICE } } });
    await t.engine.start();
    await flush();
    expect(t.notices).toEqual(['Sem acesso ao microfone: você vai só ouvir']);
    expect(t.socket.emitted[0].payload).toMatchObject({ muted: true });
    expect(FakePC.all[0].transceivers[0].direction).toBe('recvonly');
    expect(t.last()).toMatchObject({ status: 'live', hasMic: false });
  });

  it('gives up when the server refuses the join', async () => {
    const t = setup({ joinAck: { ok: false, error: { code: 'ROOM_FULL', message: 'O canal de voz está cheio' } } });
    await t.engine.start();
    await flush();
    expect(t.notices).toEqual(['O canal de voz está cheio']);
    expect(t.last().status).toBe('off');
    expect(t.mic.track.stop).toHaveBeenCalled();
    expect(t.socket.connected).toBe(false);
  });

  it('mutes the microphone track and tells the channel', async () => {
    const t = setup();
    await t.engine.start();
    await flush();
    t.engine.setMuted(true);
    expect(t.mic.track.enabled).toBe(false);
    expect(t.socket.emitted.at(-1)).toEqual({ event: 'voice:mute', payload: { muted: true } });
    expect(t.last().muted).toBe(true);
    t.socket.fire('voice:peer_joined', ana);
    t.socket.fire('voice:peer_updated', { peerId: 'p-ana', muted: true });
    t.socket.fire('voice:peer_updated', { peerId: 'ghost', muted: true });
    expect(t.last().peers[0].muted).toBe(true);
  });

  it('starts muted when asked to', async () => {
    const t = setup();
    await t.engine.start(true);
    await flush();
    expect(t.mic.track.enabled).toBe(false);
    expect(t.socket.emitted[0].payload).toMatchObject({ muted: true });
  });

  it('closes the link of a peer that left', async () => {
    const t = setup({ joinAck: { ok: true, data: { peerId: 'me', peers: [ana], iceServers: ICE } } });
    await t.engine.start();
    await flush();
    const remote = fakeStream();
    FakePC.all[0].ontrack?.({ streams: [remote], track: remote.track });
    t.socket.fire('voice:peer_left', { peerId: 'p-ana' });
    expect(FakePC.all[0].closed).toBe(true);
    expect(t.stopAudio).toHaveBeenCalled();
    expect(t.last().peers).toEqual([]);
  });

  it('leaves, releasing the microphone and the socket', async () => {
    const t = setup({ joinAck: { ok: true, data: { peerId: 'me', peers: [ana], iceServers: ICE } } });
    await t.engine.start();
    await flush();
    t.engine.stop();
    expect(t.socket.emitted.some((e) => e.event === 'voice:leave')).toBe(true);
    expect(FakePC.all[0].closed).toBe(true);
    expect(t.mic.track.stop).toHaveBeenCalled();
    expect(t.socket.connected).toBe(false);
    expect(t.socket.listenerCount('voice:signal')).toBe(0);
    expect(t.last().status).toBe('off');
    t.engine.stop();
  });

  it('stops when the server removes it', async () => {
    const t = setup();
    await t.engine.start();
    await flush();
    t.socket.fire('voice:removed', { reason: 'replaced' });
    expect(t.notices).toEqual(['Você entrou na voz por outra aba']);
    expect(t.last().status).toBe('off');
    expect(t.socket.emitted.some((e) => e.event === 'voice:leave')).toBe(false);
  });

  it('stops when the session expired', async () => {
    const t = setup();
    await t.engine.start();
    await flush();
    t.socket.fire('connect_error', new Error('xhr poll error'));
    expect(t.last().status).toBe('live');
    t.socket.fire('connect_error', new Error('UNAUTHENTICATED'));
    expect(t.notices).toEqual(['Sua sessão expirou. Entre de novo.']);
    expect(t.last().status).toBe('off');
  });

  it('rejoins as a newcomer after reconnecting', async () => {
    const t = setup({ joinAck: { ok: true, data: { peerId: 'me', peers: [ana], iceServers: ICE } } });
    await t.engine.start();
    await flush();
    t.socket.fire('disconnect');
    expect(FakePC.all[0].closed).toBe(true);
    expect(t.last().status).toBe('joining');
    t.socket.fire('connect');
    await flush();
    expect(t.socket.emitted.filter((e) => e.event === 'voice:join')).toHaveLength(2);
    expect(FakePC.all).toHaveLength(2);
    expect(t.last().status).toBe('live');
  });

  it('connects the socket first when it is offline', async () => {
    const t = setup();
    t.socket.connected = false;
    await t.engine.start();
    expect(t.socket.connected).toBe(true);
    expect(t.socket.emitted).toEqual([]);
    t.socket.fire('connect');
    await flush();
    expect(t.last().status).toBe('live');
  });

  it('restarts ICE on a failed link it started', async () => {
    const t = setup({ joinAck: { ok: true, data: { peerId: 'me', peers: [ana], iceServers: ICE } } });
    await t.engine.start();
    await flush();
    FakePC.all[0].setState('failed');
    await flush();
    expect(FakePC.all[0].restarted).toBe(true);
    expect(t.signals().at(-1)).toEqual({ to: 'p-ana', data: { kind: 'offer', sdp: 'offer-restart' } });
  });

  it('shows who is speaking', async () => {
    vi.useFakeTimers();
    try {
      const levels = new Map<MediaStream, number>();
      const t = setup({ levels, joinAck: { ok: true, data: { peerId: 'me', peers: [ana], iceServers: ICE } } });
      await t.engine.start();
      await vi.advanceTimersByTimeAsync(0);
      const remote = fakeStream();
      FakePC.all[0].ontrack?.({ streams: [remote], track: remote.track });
      levels.set(t.mic, 0.2);
      levels.set(remote, 0.3);
      await vi.advanceTimersByTimeAsync(200);
      expect(t.last()).toMatchObject({ speaking: true, peers: [{ speaking: true }] });
      t.engine.setMuted(true);
      levels.set(remote, 0);
      await vi.advanceTimersByTimeAsync(200);
      expect(t.last()).toMatchObject({ speaking: false, peers: [{ speaking: false }] });
      t.engine.stop();
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not start twice and survives a stop during the microphone prompt', async () => {
    const t = setup();
    const started = t.engine.start();
    void t.engine.start();
    t.engine.stop();
    await started;
    await flush();
    expect(t.deps.getUserMedia).toHaveBeenCalledTimes(1);
    expect(t.mic.track.stop).toHaveBeenCalled();
    expect(t.socket.emitted).toEqual([]);
  });
});

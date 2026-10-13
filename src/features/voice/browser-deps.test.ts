import { FakeSocket } from '@/test/fake-socket';

async function load() {
  vi.resetModules();
  return import('./browser-deps');
}

describe('browser voice deps', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('needs a secure page with WebRTC and a microphone API', async () => {
    const { voiceSupported } = await load();
    vi.stubGlobal('isSecureContext', true);
    vi.stubGlobal('RTCPeerConnection', undefined);
    expect(voiceSupported()).toBe(false);
    vi.stubGlobal('RTCPeerConnection', class {});
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn() } });
    expect(voiceSupported()).toBe(true);
    vi.stubGlobal('isSecureContext', false);
    expect(voiceSupported()).toBe(false);
  });

  it('wires the browser APIs', async () => {
    const { browserVoiceDeps } = await load();
    const getUserMedia = vi.fn().mockResolvedValue('stream');
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } });
    const PC = vi.fn();
    vi.stubGlobal('RTCPeerConnection', PC);
    const audio = { play: vi.fn().mockRejectedValue(new Error('blocked')), pause: vi.fn(), srcObject: null as unknown, autoplay: false };
    vi.stubGlobal(
      'Audio',
      vi.fn(function () {
        return audio;
      }),
    );
    const deps = browserVoiceDeps(new FakeSocket().asSocket());

    await expect(deps.getUserMedia({ audio: true })).resolves.toBe('stream');
    deps.createPeerConnection({ iceServers: [] });
    expect(PC).toHaveBeenCalledWith({ iceServers: [] });

    const stream = {} as MediaStream;
    const stop = deps.play(stream);
    expect(audio).toMatchObject({ autoplay: true, srcObject: stream });
    stop();
    expect(audio.pause).toHaveBeenCalled();
    expect(audio.srcObject).toBeNull();
  });

  it('measures the audio level of a stream', async () => {
    const { browserVoiceDeps } = await load();
    const source = { connect: vi.fn(), disconnect: vi.fn() };
    const analyser = {
      fftSize: 0,
      getFloatTimeDomainData: (buf: Float32Array) => buf.fill(0.5),
    };
    vi.stubGlobal(
      'AudioContext',
      vi.fn(function () {
        return { resume: vi.fn().mockResolvedValue(undefined), createMediaStreamSource: () => source, createAnalyser: () => analyser };
      }),
    );
    const meter = browserVoiceDeps(new FakeSocket().asSocket()).meter({} as MediaStream);
    expect(meter?.level()).toBeCloseTo(0.5);
    meter?.stop();
    expect(source.disconnect).toHaveBeenCalled();
  });

  it('gives up measuring where Web Audio is missing', async () => {
    const { browserVoiceDeps } = await load();
    vi.stubGlobal(
      'AudioContext',
      vi.fn(function () {
        throw new Error('nope');
      }),
    );
    expect(browserVoiceDeps(new FakeSocket().asSocket()).meter({} as MediaStream)).toBeNull();
  });
});

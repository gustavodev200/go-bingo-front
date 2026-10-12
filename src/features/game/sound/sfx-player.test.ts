import { createSfxPlayer, type AudioCtxLike } from './sfx-player';
import { SFX_NOTES } from './sfx';

function fakeAudio(state: AudioContextState = 'running') {
  const oscillators: { type: string; freq: number[]; started: number; stopped: number }[] = [];
  const param = () => ({ setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() });
  const ctx = {
    currentTime: 10,
    state,
    resume: vi.fn(async () => {
      ctx.state = 'running';
    }),
    suspend: vi.fn(async () => {
      ctx.state = 'suspended';
    }),
    destination: {},
    createGain: () => ({ gain: param(), connect: vi.fn() }),
    createOscillator: () => {
      const o = { type: 'sine', freq: [] as number[], started: 0, stopped: 0 };
      oscillators.push(o);
      return {
        set type(v: string) {
          o.type = v;
        },
        frequency: { setValueAtTime: (f: number) => o.freq.push(f) },
        connect: vi.fn(),
        start: (t: number) => (o.started = t),
        stop: (t: number) => (o.stopped = t),
      };
    },
  };
  return { ctx: ctx as unknown as AudioCtxLike, oscillators, resume: ctx.resume, suspend: ctx.suspend, raw: ctx };
}

describe('createSfxPlayer', () => {
  it('schedules one oscillator per note, starting now', () => {
    const audio = fakeAudio();
    const player = createSfxPlayer(() => audio.ctx);
    player.play('draw');
    expect(audio.oscillators).toHaveLength(SFX_NOTES.draw.length);
    expect(audio.oscillators[0].freq[0]).toBe(SFX_NOTES.draw[0].freq);
    expect(audio.oscillators[0].started).toBeCloseTo(10 + SFX_NOTES.draw[0].at);
    expect(audio.oscillators[0].stopped).toBeGreaterThan(audio.oscillators[0].started);
  });

  it('creates the AudioContext lazily, once, and resumes a suspended one', () => {
    const audio = fakeAudio('suspended');
    const factory = vi.fn(() => audio.ctx);
    const player = createSfxPlayer(factory);
    expect(factory).not.toHaveBeenCalled();
    player.unlock();
    player.play('draw');
    expect(factory).toHaveBeenCalledTimes(1);
    expect(audio.resume).toHaveBeenCalled();
  });

  it('resumes an interrupted context (iOS after a call) and reports when it is running', () => {
    const audio = fakeAudio('interrupted' as AudioContextState);
    const player = createSfxPlayer(() => audio.ctx);
    expect(player.isRunning()).toBe(false);
    player.unlock();
    expect(audio.resume).toHaveBeenCalled();
    const running = createSfxPlayer(() => fakeAudio('running').ctx);
    running.unlock();
    expect(running.isRunning()).toBe(true);
  });

  it('is a silent no-op without WebAudio', () => {
    const player = createSfxPlayer(() => null);
    expect(() => {
      player.unlock();
      player.play('bingo-me');
    }).not.toThrow();
  });

  describe('idle suspend (battery)', () => {
    afterEach(() => vi.useRealTimers());

    it('suspends the context once the last sound ends and nothing else plays', async () => {
      vi.useFakeTimers();
      const audio = fakeAudio();
      const player = createSfxPlayer(() => audio.ctx, 3000);
      player.play('draw');
      const lastEndMs = Math.max(...SFX_NOTES.draw.map((n) => (n.at + n.dur + 0.02) * 1000));
      await vi.advanceTimersByTimeAsync(lastEndMs + 2900);
      expect(audio.suspend).not.toHaveBeenCalled();
      player.play('draw'); // novo som adia a suspensão
      await vi.advanceTimersByTimeAsync(lastEndMs + 2900);
      expect(audio.suspend).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(200);
      expect(audio.suspend).toHaveBeenCalledTimes(1);
      // Suspenso por ociosidade ainda conta como liberado (não volta a pedir gesto).
      expect(player.isRunning()).toBe(true);
    });

    it('resumes automatically on the next sound', async () => {
      vi.useFakeTimers();
      const audio = fakeAudio();
      const player = createSfxPlayer(() => audio.ctx, 1000);
      player.unlock();
      await vi.advanceTimersByTimeAsync(1100);
      expect(audio.suspend).toHaveBeenCalledTimes(1);
      player.play('draw');
      expect(audio.resume).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(0);
      expect(audio.raw.state).toBe('running');
      expect(audio.oscillators.length).toBeGreaterThan(0);
    });
  });
});

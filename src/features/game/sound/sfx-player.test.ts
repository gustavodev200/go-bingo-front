import { createSfxPlayer, type AudioCtxLike } from './sfx-player';
import { SFX_NOTES } from './sfx';

function fakeAudio(state: AudioContextState = 'running') {
  const oscillators: { type: string; freq: number[]; started: number; stopped: number }[] = [];
  const param = () => ({ setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() });
  const ctx = {
    currentTime: 10,
    state,
    resume: vi.fn(async () => undefined),
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
  return { ctx: ctx as unknown as AudioCtxLike, oscillators, resume: ctx.resume };
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
});

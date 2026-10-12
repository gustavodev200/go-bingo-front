import { act, renderHook } from '@testing-library/react';
import { playReaction, useTrucoAudioPrefs } from './audio';

function deps(supported = true) {
  return {
    sfx: { play: vi.fn(), unlock: vi.fn(), isRunning: () => true },
    narrator: { supported, speak: vi.fn() },
  };
}

describe('playReaction', () => {
  const reaction = { sfx: 'truco' as const, speech: 'TRUUUCO!' };

  it('plays sound and voice when both are on', () => {
    const d = deps();
    playReaction(reaction, { voice: true, sfx: true }, d);
    expect(d.sfx.play).toHaveBeenCalledWith('truco');
    expect(d.narrator.speak).toHaveBeenCalledWith('TRUUUCO!');
  });

  it('respects each switch independently', () => {
    const d = deps();
    playReaction(reaction, { voice: false, sfx: true }, d);
    expect(d.narrator.speak).not.toHaveBeenCalled();
    expect(d.sfx.play).toHaveBeenCalledTimes(1);
    playReaction(reaction, { voice: true, sfx: false }, d);
    expect(d.sfx.play).toHaveBeenCalledTimes(1);
    expect(d.narrator.speak).toHaveBeenCalledTimes(1);
  });

  it('stays silent on browsers without speech synthesis', () => {
    const d = deps(false);
    playReaction(reaction, { voice: true, sfx: false }, d);
    expect(d.narrator.speak).not.toHaveBeenCalled();
  });
});

describe('useTrucoAudioPrefs', () => {
  beforeEach(() => localStorage.clear());

  it('starts with both on and remembers each choice separately', () => {
    const { result } = renderHook(() => useTrucoAudioPrefs());
    expect(result.current).toMatchObject({ voice: true, sfx: true });
    act(() => result.current.setVoice(false));
    expect(result.current).toMatchObject({ voice: false, sfx: true });
    expect(localStorage.getItem('truco:voice')).toBe('0');
    expect(localStorage.getItem('truco:sfx')).toBeNull();
    const again = renderHook(() => useTrucoAudioPrefs());
    expect(again.result.current.voice).toBe(false);
  });
});

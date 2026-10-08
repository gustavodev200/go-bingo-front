import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import type { RoomSnapshot } from '@/contracts';
import { initialGameState, reduce, useGameStore } from '../store';
import { ballPhrase, createNarrator, type Narrator, type SpeechLike, type UtteranceLike } from './narration';
import { NarrationToggle } from './narration-toggle';
import { useNarration, useNarrationEnabled } from './use-narration';

const ME = '00000000-0000-4000-8000-000000000001';
const inGame = (drawn: number[]): RoomSnapshot => ({
  code: 'ABC234', name: 'Sala', hostId: ME, maxPlayers: 10, isPublic: true, winPattern: 'FULL_CARD', status: 'IN_GAME',
  members: [{ userId: ME, nickname: 'Eu', character: null, slot: 0, isGuest: false, connected: true, hasCard: true }],
  myCard: null,
  game: { id: '00000000-0000-4000-8000-0000000000bb', drawn, drawIntervalMs: 5000, remaining: {} },
});
const drawn = (number: number) => ({ event: 'game:number_drawn' as const, payload: { seq: 9, number, letter: 'B' as const, drawnAt: new Date(0).toISOString() } });

function fakeSynth(voices: Array<{ lang: string; name: string }> = []) {
  const spoken: UtteranceLike[] = [];
  const synth: SpeechLike = { speak: vi.fn((u: UtteranceLike) => spoken.push(u)), cancel: vi.fn(), getVoices: () => voices as never };
  return { synth, spoken };
}
const utter = (text: string): UtteranceLike => ({ text, lang: '', rate: 1, voice: null });

describe('ballPhrase', () => {
  it('reads letter then number', () => {
    expect(ballPhrase(7)).toBe('B, 7');
    expect(ballPhrase(75)).toBe('O, 75');
  });
});

describe('createNarrator', () => {
  it('speaks in pt-BR, preferring a Brazilian voice, and cuts the previous phrase', () => {
    const { synth, spoken } = fakeSynth([
      { lang: 'en-US', name: 'Alex' },
      { lang: 'pt-BR', name: 'Luciana' },
    ]);
    const narrator = createNarrator({ synth, utter });
    expect(narrator.supported).toBe(true);
    narrator.speak('B, 7');
    expect(synth.cancel).toHaveBeenCalled();
    expect(spoken[0]).toMatchObject({ text: 'B, 7', lang: 'pt-BR', voice: { name: 'Luciana' } });
  });

  it('falls back to any Portuguese voice, then to the default voice', () => {
    const pt = fakeSynth([{ lang: 'pt_PT', name: 'Joana' }]);
    createNarrator({ synth: pt.synth, utter }).speak('x');
    expect(pt.spoken[0].voice).toMatchObject({ name: 'Joana' });
    const none = fakeSynth([{ lang: 'en-US', name: 'Alex' }]);
    createNarrator({ synth: none.synth, utter }).speak('x');
    expect(none.spoken[0].voice).toBeNull();
  });

  it('without speech synthesis it is unsupported and silent', () => {
    const narrator = createNarrator({ synth: null, utter });
    expect(narrator.supported).toBe(false);
    expect(() => narrator.speak('x')).not.toThrow();
  });
});

describe('useNarration', () => {
  let narrator: Narrator & { speak: ReturnType<typeof vi.fn<(text: string) => void>> };
  beforeEach(() => {
    narrator = { supported: true, speak: vi.fn<(text: string) => void>() };
    useGameStore.setState(reduce(initialGameState(ME), { event: 'room:state', payload: inGame([1, 2]) }));
  });

  it('is silent on the first state, then narrates each new ball', () => {
    renderHook(() => useNarration(true, narrator));
    expect(narrator.speak).not.toHaveBeenCalled();
    act(() => useGameStore.getState().dispatch(drawn(7)));
    expect(narrator.speak).toHaveBeenCalledWith('B, 7');
  });

  it('says nothing when disabled', () => {
    renderHook(() => useNarration(false, narrator));
    act(() => useGameStore.getState().dispatch(drawn(7)));
    expect(narrator.speak).not.toHaveBeenCalled();
  });

  it('a resync after reconnecting becomes the new baseline (no backlog reading)', () => {
    renderHook(() => useNarration(true, narrator));
    act(() => useGameStore.getState().setConnection('reconnecting'));
    act(() => useGameStore.getState().dispatch({ event: 'room:state', payload: inGame([1, 2, 3, 4, 5]) }));
    act(() => useGameStore.getState().setConnection('online'));
    expect(narrator.speak).not.toHaveBeenCalled();
    act(() => useGameStore.getState().dispatch(drawn(70)));
    expect(narrator.speak).toHaveBeenCalledTimes(1);
    expect(narrator.speak).toHaveBeenCalledWith('O, 70');
  });

  it('defaults to on and remembers when the user turns it off', () => {
    localStorage.clear();
    const { result } = renderHook(() => useNarrationEnabled());
    expect(result.current[0]).toBe(true);
    act(() => result.current[1](false));
    expect(renderHook(() => useNarrationEnabled()).result.current[0]).toBe(false);
  });
});

describe('NarrationToggle', () => {
  it('turns narration on and confirms out loud (also unlocks speech on iOS)', () => {
    const narrator = { supported: true, speak: vi.fn<(text: string) => void>() };
    const onChange = vi.fn();
    render(<NarrationToggle enabled={false} onChange={onChange} narrator={narrator} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ligar narração' }));
    expect(onChange).toHaveBeenCalledWith(true);
    expect(narrator.speak).toHaveBeenCalledWith('Narração ligada');
  });

  it('turns it off quietly', () => {
    const narrator = { supported: true, speak: vi.fn<(text: string) => void>() };
    const onChange = vi.fn();
    render(<NarrationToggle enabled onChange={onChange} narrator={narrator} />);
    const button = screen.getByRole('button', { name: 'Desligar narração' });
    expect(button).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(button);
    expect(onChange).toHaveBeenCalledWith(false);
    expect(narrator.speak).not.toHaveBeenCalled();
  });

  it('is hidden where speech is not supported', () => {
    const { container } = render(<NarrationToggle enabled={false} onChange={vi.fn()} narrator={{ supported: false, speak: vi.fn() }} />);
    expect(container).toBeEmptyDOMElement();
  });
});

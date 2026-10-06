import { act, renderHook } from '@testing-library/react';
import { useSceneMode } from './use-scene-mode';

function setWebgl2(ok: boolean) {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(((type: string) => (type === 'webgl2' && ok ? ({} as WebGL2RenderingContext) : null)) as never);
}
function setReducedMotion(on: boolean) {
  window.matchMedia = vi.fn().mockImplementation((q: string) => ({ matches: on && q.includes('reduce'), media: q })) as unknown as typeof window.matchMedia;
}

describe('useSceneMode', () => {
  beforeEach(() => {
    localStorage.clear();
    setWebgl2(true);
    setReducedMotion(false);
  });
  afterEach(() => vi.restoreAllMocks());

  it('3D on a capable device', () => {
    expect(renderHook(() => useSceneMode()).result.current).toMatchObject({ mode: '3d', reason: 'ok', quality: 'auto' });
  });

  it('2D without WebGL2', () => {
    setWebgl2(false);
    expect(renderHook(() => useSceneMode()).result.current).toMatchObject({ mode: '2d', reason: 'no-webgl2' });
  });

  it('2D when probing WebGL throws', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(renderHook(() => useSceneMode()).result.current.mode).toBe('2d');
  });

  it('2D with reduced motion, unless the user picks 3D (persisted)', () => {
    setReducedMotion(true);
    const { result } = renderHook(() => useSceneMode());
    expect(result.current.mode).toBe('2d');
    act(() => result.current.setPreferred('3d'));
    expect(result.current.mode).toBe('3d');
    expect(localStorage.getItem('go-bingo:scene-mode')).toBe('3d');
  });

  it('first context loss remounts the stage; the second falls back to 2D', () => {
    const { result } = renderHook(() => useSceneMode());
    const key = result.current.stageKey;
    act(() => result.current.reportContextLoss());
    expect(result.current).toMatchObject({ mode: '3d' });
    expect(result.current.stageKey).not.toBe(key);
    act(() => result.current.reportContextLoss());
    expect(result.current).toMatchObject({ mode: '2d', reason: 'context-lost' });
  });

  it('notifies the telemetry callback on every context loss', () => {
    const onLoss = vi.fn();
    const { result } = renderHook(() => useSceneMode(onLoss));
    act(() => result.current.reportContextLoss());
    act(() => result.current.reportContextLoss());
    expect(onLoss).toHaveBeenCalledTimes(2);
  });

  it('a crashed stage falls back to 2D for the rest of the visit', () => {
    const { result } = renderHook(() => useSceneMode());
    act(() => result.current.reportFailure());
    expect(result.current).toMatchObject({ mode: '2d', reason: 'failed' });
  });

  it('persists the quality override', () => {
    const { result } = renderHook(() => useSceneMode());
    act(() => result.current.setQuality('low'));
    expect(result.current.quality).toBe('low');
    expect(localStorage.getItem('go-bingo:scene-quality')).toBe('low');
  });
});

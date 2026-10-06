import { pickDisplayMode, type DisplaySignals } from './display-mode';

const base: DisplaySignals = { webgl2: true, reducedMotion: false, preferred: null, contextLosses: 0, failed: false };

describe('pickDisplayMode', () => {
  it('3D by default', () => expect(pickDisplayMode(base)).toEqual({ mode: '3d', reason: 'ok' }));
  it('2D without WebGL2, even if the user asked for 3D', () =>
    expect(pickDisplayMode({ ...base, webgl2: false, preferred: '3d' })).toEqual({ mode: '2d', reason: 'no-webgl2' }));
  it('2D after two context losses', () => expect(pickDisplayMode({ ...base, contextLosses: 2 })).toEqual({ mode: '2d', reason: 'context-lost' }));
  it('one context loss is retried in 3D', () => expect(pickDisplayMode({ ...base, contextLosses: 1 }).mode).toBe('3d'));
  it('2D when the 3D stage failed to load, even if the user asked for 3D', () =>
    expect(pickDisplayMode({ ...base, failed: true, preferred: '3d' })).toEqual({ mode: '2d', reason: 'failed' }));
  it('2D when the user chose it', () => expect(pickDisplayMode({ ...base, preferred: '2d' })).toEqual({ mode: '2d', reason: 'user' }));
  it('2D with reduced motion', () => expect(pickDisplayMode({ ...base, reducedMotion: true })).toEqual({ mode: '2d', reason: 'reduced-motion' }));
  it('an explicit 3D choice wins over reduced motion', () =>
    expect(pickDisplayMode({ ...base, reducedMotion: true, preferred: '3d' })).toEqual({ mode: '3d', reason: 'ok' }));
});

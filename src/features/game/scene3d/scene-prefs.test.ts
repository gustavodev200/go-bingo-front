import { readPreferredMode, readQualityOverride, writePreferredMode, writeQualityOverride } from './scene-prefs';

describe('scene-prefs', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('round-trips the preferences', () => {
    expect(readPreferredMode()).toBeNull();
    expect(readQualityOverride()).toBe('auto');
    writePreferredMode('2d');
    writeQualityOverride('low');
    expect(readPreferredMode()).toBe('2d');
    expect(readQualityOverride()).toBe('low');
  });

  it('ignores garbage values', () => {
    localStorage.setItem('go-bingo:scene-mode', 'vr');
    localStorage.setItem('go-bingo:scene-quality', 'ultra');
    expect(readPreferredMode()).toBeNull();
    expect(readQualityOverride()).toBe('auto');
  });

  it('falls back to defaults when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(readPreferredMode()).toBeNull();
    expect(readQualityOverride()).toBe('auto');
    expect(() => writePreferredMode('3d')).not.toThrow();
    expect(() => writeQualityOverride('high')).not.toThrow();
  });
});

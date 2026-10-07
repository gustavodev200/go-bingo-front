import { TIER_SETTINGS, initialQuality, pickInitialTier, stepDown, stepUp, type QualityState } from './quality';

describe('pickInitialTier', () => {
  it('high on strong devices', () => expect(pickInitialTier({ cores: 8, memoryGb: 8, screenWidth: 1440 })).toBe('high'));
  it('unknown memory (Safari) is not held against the device', () => expect(pickInitialTier({ cores: 8, memoryGb: null, screenWidth: 1440 })).toBe('high'));
  it('low on weak devices', () => {
    expect(pickInitialTier({ cores: 4, memoryGb: 8, screenWidth: 1440 })).toBe('low');
    expect(pickInitialTier({ cores: 8, memoryGb: 2, screenWidth: 1440 })).toBe('low');
  });
  it('Safari with few reported cores (iPhone) starts at medium, not low', () => expect(pickInitialTier({ cores: 4, memoryGb: null, screenWidth: 390 })).toBe('medium'));
  it('medium in between', () => expect(pickInitialTier({ cores: 6, memoryGb: 4, screenWidth: 1440 })).toBe('medium'));
  it('small screens are capped at medium', () => expect(pickInitialTier({ cores: 8, memoryGb: 8, screenWidth: 390 })).toBe('medium'));
});

describe('initialQuality', () => {
  it('starts at min(devicePixelRatio, 2, tier max)', () => {
    expect(initialQuality('high', 3)).toEqual({ tier: 'high', dpr: 2 });
    expect(initialQuality('low', 3)).toEqual({ tier: 'low', dpr: 1.5 });
    expect(initialQuality('medium', 1)).toEqual({ tier: 'medium', dpr: 1 });
  });
});

describe('stepDown / stepUp', () => {
  it('lowers resolution first, then the tier, never below low/min', () => {
    let q = initialQuality('high', 2); // 2
    q = stepDown(q);
    expect(q).toEqual({ tier: 'high', dpr: 1.75 });
    q = stepDown(stepDown(stepDown(stepDown(q)))); // 1.0 (mínimo do alto) → desce para médio
    expect(q.tier).toBe('medium');
    for (let i = 0; i < 20; i++) q = stepDown(q);
    expect(q).toEqual({ tier: 'low', dpr: TIER_SETTINGS.low.minDpr });
  });

  it('raises resolution up to the tier max', () => {
    let q: QualityState = { tier: 'medium', dpr: 1 };
    for (let i = 0; i < 10; i++) q = stepUp(q);
    expect(q).toEqual({ tier: 'medium', dpr: TIER_SETTINGS.medium.maxDpr });
  });
});

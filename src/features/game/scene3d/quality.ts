export type Tier = 'high' | 'medium' | 'low';
export type QualityOverride = 'auto' | Tier;

export interface TierSettings {
  maxDpr: number;
  minDpr: number;
  shadows: 'real' | 'fake' | 'none';
  animatedBulbs: boolean;
  confetti: number;
  antialias: boolean;
}

export const TIER_SETTINGS: Record<Tier, TierSettings> = {
  high: { maxDpr: 2, minDpr: 1, shadows: 'real', animatedBulbs: true, confetti: 300, antialias: true },
  medium: { maxDpr: 1.5, minDpr: 0.75, shadows: 'fake', animatedBulbs: true, confetti: 120, antialias: true },
  low: { maxDpr: 1, minDpr: 0.75, shadows: 'none', animatedBulbs: false, confetti: 0, antialias: false },
};

const ORDER: Tier[] = ['low', 'medium', 'high'];
const DPR_STEP = 0.25;

export interface DeviceSignals {
  cores: number;
  /** `navigator.deviceMemory`; `null` quando o navegador não informa (Safari). */
  memoryGb: number | null;
  screenWidth: number;
}

/** Nível inicial sem rede (sem detect-gpu): sinais locais; o PerformanceMonitor corrige depois. */
export function pickInitialTier({ cores, memoryGb, screenWidth }: DeviceSignals): Tier {
  const memory = memoryGb ?? 8;
  let tier: Tier = 'medium';
  if (cores <= 4 || memory <= 3) tier = 'low';
  else if (cores >= 8 && memory >= 6) tier = 'high';
  if (tier === 'high' && screenWidth < 400) tier = 'medium';
  return tier;
}

export interface QualityState {
  tier: Tier;
  dpr: number;
}

/** RNF-3D-04: começa em min(devicePixelRatio, 1.5), respeitando o teto do nível. */
export function initialQuality(tier: Tier, devicePixelRatio: number): QualityState {
  return { tier, dpr: Math.min(devicePixelRatio, 1.5, TIER_SETTINGS[tier].maxDpr) };
}

export function stepDown(q: QualityState): QualityState {
  const settings = TIER_SETTINGS[q.tier];
  if (q.dpr - DPR_STEP >= settings.minDpr) return { tier: q.tier, dpr: q.dpr - DPR_STEP };
  const lower = ORDER[ORDER.indexOf(q.tier) - 1];
  if (!lower) return { tier: q.tier, dpr: settings.minDpr };
  return { tier: lower, dpr: Math.min(q.dpr, TIER_SETTINGS[lower].maxDpr) };
}

export function stepUp(q: QualityState): QualityState {
  return { tier: q.tier, dpr: Math.min(q.dpr + DPR_STEP, TIER_SETTINGS[q.tier].maxDpr) };
}

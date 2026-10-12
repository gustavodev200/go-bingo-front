export type Tier = 'high' | 'medium' | 'low';
export type QualityOverride = 'auto' | Tier;

export interface TierSettings {
  maxDpr: number;
  minDpr: number;
  shadows: 'real' | 'fake' | 'none';
  animatedBulbs: boolean;
  confetti: number;
  antialias: boolean;
  /** Teto de FPS com algo se mexendo de verdade (sorteio, entrada/saída, dança, câmera, comemoração). */
  activeFps: number;
  /** Teto de FPS com a cena só "respirando" (piscar, holofotes, lâmpadas): o grosso do tempo de partida. */
  idleFps: number;
}

export const TIER_SETTINGS: Record<Tier, TierSettings> = {
  // Nenhum nível passa de 60 FPS: em tela de 90/120/165 Hz o loop "always" renderizava a cada vsync (2-3× o trabalho, sem ganho visível).
  high: { maxDpr: 2, minDpr: 1, shadows: 'real', animatedBulbs: true, confetti: 300, antialias: true, activeFps: 60, idleFps: 30 },
  medium: { maxDpr: 2, minDpr: 1, shadows: 'fake', animatedBulbs: true, confetti: 120, antialias: true, activeFps: 60, idleFps: 30 },
  // Economia: mesmo no mais leve, DPR < 1 e sem antialias deixam bonecos e globo serrilhados/borrados na tela retina do celular.
  low: { maxDpr: 1.5, minDpr: 1, shadows: 'none', animatedBulbs: false, confetti: 0, antialias: true, activeFps: 30, idleFps: 20 },
};

const ORDER: Tier[] = ['low', 'medium', 'high'];
const DPR_STEP = 0.25;

export interface DeviceSignals {
  cores: number;
  /** `navigator.deviceMemory`; `null` quando o navegador não informa (Safari). */
  memoryGb: number | null;
  screenWidth: number;
}

/** Nível inicial sem rede (sem detect-gpu): sinais locais; o monitor de quadros (frame-pacing) corrige depois. */
export function pickInitialTier({ cores, memoryGb, screenWidth }: DeviceSignals): Tier {
  const memory = memoryGb ?? 8;
  let tier: Tier = 'medium';
  // Safari (iPhone/iPad) não informa memória e limita hardwareConcurrency; a GPU aguenta o médio — o monitor de quadros desce se precisar.
  if ((cores <= 4 && memoryGb !== null) || memory <= 3) tier = 'low';
  else if (cores >= 8 && memory >= 6) tier = 'high';
  if (tier === 'high' && screenWidth < 400) tier = 'medium';
  return tier;
}

export interface QualityState {
  tier: Tier;
  dpr: number;
}

/** Começa em min(devicePixelRatio, 2, teto do nível): abaixo de 2 a cena fica borrada em telas retina. */
export function initialQuality(tier: Tier, devicePixelRatio: number): QualityState {
  return { tier, dpr: Math.min(devicePixelRatio, 2, TIER_SETTINGS[tier].maxDpr) };
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

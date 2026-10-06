import type { DisplayMode } from './display-mode';
import type { QualityOverride } from './quality';

const MODE_KEY = 'go-bingo:scene-mode';
const QUALITY_KEY = 'go-bingo:scene-quality';
const QUALITIES: QualityOverride[] = ['auto', 'high', 'medium', 'low'];

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Armazenamento bloqueado: vale só nesta sessão.
  }
}

export function readPreferredMode(): DisplayMode | null {
  const value = read(MODE_KEY);
  return value === '3d' || value === '2d' ? value : null;
}

export function writePreferredMode(mode: DisplayMode) {
  write(MODE_KEY, mode);
}

export function readQualityOverride(): QualityOverride {
  const value = read(QUALITY_KEY) as QualityOverride | null;
  return value && QUALITIES.includes(value) ? value : 'auto';
}

export function writeQualityOverride(quality: QualityOverride) {
  write(QUALITY_KEY, quality);
}

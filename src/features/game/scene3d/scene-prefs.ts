import type { DisplayMode } from './display-mode';
import type { QualityOverride } from './quality';

const MODE_KEY = 'go-bingo:scene-mode';
const QUALITY_KEY = 'go-bingo:scene-quality';
const QUALITIES: QualityOverride[] = ['auto', 'high', 'medium', 'low'];
/** Disparado (nesta aba) ao trocar a qualidade; as outras abas recebem o `storage`. */
export const QUALITY_EVENT = 'go-bingo:scene-quality';
/** "Economia de bateria" é o nível baixo fixo: 30/20 FPS, sem sombras nem efeitos extras, decoração CSS parada. */
export const POWER_SAVE_QUALITY: QualityOverride = 'low';

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
  window.dispatchEvent(new Event(QUALITY_EVENT));
}

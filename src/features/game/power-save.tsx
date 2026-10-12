'use client';

import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { POWER_SAVE_QUALITY, QUALITY_EVENT, readQualityOverride, writeQualityOverride } from './scene3d/scene-prefs';

function subscribe(onChange: () => void) {
  window.addEventListener(QUALITY_EVENT, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(QUALITY_EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
}

const isOn = () => readQualityOverride() === POWER_SAVE_QUALITY;

/** Modo economia de bateria do aparelho (é a qualidade 3D "Economia"); desligar volta para a automática. */
export function usePowerSave(): [boolean, (on: boolean) => void] {
  const on = useSyncExternalStore(subscribe, isOn, () => false);
  const setOn = useCallback((next: boolean) => writeQualityOverride(next ? POWER_SAVE_QUALITY : 'auto'), []);
  return [on, setOn];
}

/** `<html data-power-save>` com o modo ligado: o CSS para a decoração animada do salão (stage.module.css). */
export function PowerSaveSync() {
  const [on] = usePowerSave();
  useEffect(() => {
    if (!on) return;
    document.documentElement.dataset.powerSave = '';
    return () => {
      delete document.documentElement.dataset.powerSave;
    };
  }, [on]);
  return null;
}

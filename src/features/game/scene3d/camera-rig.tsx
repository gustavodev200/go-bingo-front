'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import type { PerspectiveCamera } from 'three';
import { approach, cameraFor, focusOn, orbitPosition, type CameraView } from './camera';
import type { Vec3 } from './slots';

const MAX_YAW = 0.26; // ~15°

/**
 * Enquadra pelo aspect da região do canvas (lobby ou partida); arrasto horizontal gira até ±15° e volta com mola.
 * Com `focus`, a câmera desliza até o avatar vencedor.
 */
export function CameraRig({ view = 'lobby', focus = null, spread }: { view?: CameraView; focus?: Vec3 | null; spread?: number }) {
  const gl = useThree((s) => s.gl);
  const yaw = useRef(0);
  const targetYaw = useRef(0);
  const pos = useRef<Vec3 | null>(null);
  const look = useRef<Vec3 | null>(null);

  useEffect(() => {
    const el = gl.domElement;
    let startX: number | null = null;
    const down = (e: PointerEvent) => {
      startX = e.clientX;
    };
    const move = (e: PointerEvent) => {
      if (startX === null) return;
      const dx = (e.clientX - startX) / Math.max(1, el.clientWidth);
      targetYaw.current = Math.max(-MAX_YAW, Math.min(MAX_YAW, -dx * 0.8));
    };
    const up = () => {
      startX = null;
      targetYaw.current = 0;
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointercancel', up);
    window.addEventListener('pointerup', up);
    return () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointercancel', up);
      window.removeEventListener('pointerup', up);
    };
  }, [gl]);

  useFrame((state, delta) => {
    const camera = state.camera as PerspectiveCamera;
    yaw.current += (targetYaw.current - yaw.current) * Math.min(1, delta * 8);
    const setup = focus ? focusOn(focus) : cameraFor(state.size.width / Math.max(1, state.size.height), view, spread);
    const desired = focus ? setup.position : orbitPosition(setup, yaw.current);
    pos.current = pos.current ? approach(pos.current, desired, delta, 2.5) : desired;
    look.current = look.current ? approach(look.current, setup.target, delta, 2.5) : setup.target;
    if (Math.abs(camera.fov - setup.fov) > 0.01) {
      camera.fov += (setup.fov - camera.fov) * Math.min(1, delta * 2.5);
      camera.updateProjectionMatrix();
    }
    camera.position.set(...pos.current);
    camera.lookAt(...look.current);
  });

  return null;
}

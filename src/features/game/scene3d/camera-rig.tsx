'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import type { PerspectiveCamera } from 'three';
import { cameraFor, orbitPosition } from './camera';

const MAX_YAW = 0.26; // ~15°

/** Enquadra pelo aspect da região do canvas; arrasto horizontal gira até ±15° e volta com mola. */
export function CameraRig() {
  const gl = useThree((s) => s.gl);
  const yaw = useRef(0);
  const targetYaw = useRef(0);

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
    const setup = cameraFor(state.size.width / Math.max(1, state.size.height));
    yaw.current += (targetYaw.current - yaw.current) * Math.min(1, delta * 8);
    if (camera.fov !== setup.fov) {
      camera.fov = setup.fov;
      camera.updateProjectionMatrix();
    }
    camera.position.set(...orbitPosition(setup, yaw.current));
    camera.lookAt(...setup.target);
  });

  return null;
}

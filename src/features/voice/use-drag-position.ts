'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties, type MouseEvent, type PointerEvent } from 'react';

/** Distance (px) a press must travel to become a drag instead of a click. */
const DRAG_THRESHOLD = 6;
/** Gap kept between the element and the screen edges. */
const MARGIN = 8;

/** Where the element sits, as a fraction (0..1) of the free space on each axis. */
export interface DragPosition {
  x: number;
  y: number;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function readStored(key: string, fallback: DragPosition): DragPosition {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<DragPosition>;
    if (typeof parsed.x !== 'number' || typeof parsed.y !== 'number') return fallback;
    return { x: clamp01(parsed.x), y: clamp01(parsed.y) };
  } catch {
    return fallback;
  }
}

interface Size {
  w: number;
  h: number;
}

/** Room left on each axis once the element and the margins are taken out. */
function free(size: Size, viewport: Size): Size {
  return {
    w: Math.max(0, viewport.w - size.w - 2 * MARGIN),
    h: Math.max(0, viewport.h - size.h - 2 * MARGIN),
  };
}

const viewportSize = (): Size => ({ w: window.innerWidth, h: window.innerHeight });

/**
 * Lets a fixed element be dragged anywhere on screen (mouse or touch) and
 * remembers the spot. A press that barely moves stays a normal click.
 */
export function useDragPosition<T extends HTMLElement>(storageKey: string, fallback: DragPosition) {
  const ref = useRef<T | null>(null);
  const [pos, setPos] = useState<DragPosition>(() => readStored(storageKey, fallback));
  const [viewport, setViewport] = useState<Size>(viewportSize);
  const [size, setSize] = useState<Size>({ w: 0, h: 0 });
  const [dragging, setDragging] = useState(false);
  const suppressClick = useRef(false);

  // Positions are relative to the free space, so a resize, a rotation or the panel growing only needs a re-render.
  useEffect(() => {
    const onResize = () => setViewport(viewportSize());
    window.addEventListener('resize', onResize);
    const el = ref.current;
    const measure = () => {
      const rect = el?.getBoundingClientRect();
      if (rect) setSize({ w: rect.width, h: rect.height });
    };
    measure();
    const observer = typeof ResizeObserver === 'undefined' || !el ? null : new ResizeObserver(measure);
    if (el) observer?.observe(el);
    return () => {
      window.removeEventListener('resize', onResize);
      observer?.disconnect();
    };
  }, []);

  const onPointerDown = useCallback(
    (e: PointerEvent<T>) => {
      if (e.button !== 0) return;
      const el = ref.current;
      if (!el) return;
      const startX = e.clientX;
      const startY = e.clientY;
      const rect = el.getBoundingClientRect();
      const offsetX = startX - rect.left;
      const offsetY = startY - rect.top;
      let moved = false;
      let latest = pos;

      const onMove = (ev: globalThis.PointerEvent) => {
        if (!moved && Math.hypot(ev.clientX - startX, ev.clientY - startY) < DRAG_THRESHOLD) return;
        if (!moved) {
          moved = true;
          setDragging(true);
        }
        ev.preventDefault();
        const space = free({ w: rect.width, h: rect.height }, viewportSize());
        latest = {
          x: space.w ? clamp01((ev.clientX - offsetX - MARGIN) / space.w) : 0,
          y: space.h ? clamp01((ev.clientY - offsetY - MARGIN) / space.h) : 0,
        };
        setPos(latest);
      };
      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
        if (!moved) return;
        // The click that follows the release belongs to the drag, not to the button under it.
        suppressClick.current = true;
        setDragging(false);
        try {
          window.localStorage.setItem(storageKey, JSON.stringify(latest));
        } catch {
          // Without storage the spot just resets on the next visit.
        }
      };
      window.addEventListener('pointermove', onMove, { passive: false });
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
    },
    [pos, storageKey],
  );

  const onClickCapture = useCallback((e: MouseEvent<T>) => {
    if (!suppressClick.current) return;
    suppressClick.current = false;
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const space = free(size, viewport);
  const style: CSSProperties = {
    position: 'fixed',
    left: MARGIN + pos.x * space.w,
    top: MARGIN + pos.y * space.h,
    touchAction: 'none',
    cursor: dragging ? 'grabbing' : undefined,
  };

  return { ref, style, dragging, onPointerDown, onClickCapture };
}

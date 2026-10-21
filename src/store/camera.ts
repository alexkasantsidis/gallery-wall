import { animate, motionValue } from 'motion/react';
import { create } from 'zustand';
import { PPI } from '../model/units';
import type { Rect } from '../model/types';
import { useUi } from './uiStore';

/**
 * The camera lives in MotionValues so pan/zoom never re-renders React.
 * Screen position (relative to the viewport) = t + worldInches * PPI * z
 */
export const cam = {
  tx: motionValue(0),
  ty: motionValue(0),
  z: motionValue(0.12),
};

export const MIN_ZOOM = 0.03;
export const MAX_ZOOM = 6;

/** Viewport element registered by <Viewport/>. */
export const viewportEl: { current: HTMLDivElement | null } = { current: null };

export function viewportSize() {
  const el = viewportEl.current;
  return el ? { w: el.clientWidth, h: el.clientHeight } : { w: window.innerWidth, h: window.innerHeight };
}

export function screenToWorld(sx: number, sy: number) {
  const z = cam.z.get();
  return { x: (sx - cam.tx.get()) / (PPI * z), y: (sy - cam.ty.get()) / (PPI * z) };
}

export function worldToScreen(x: number, y: number) {
  const z = cam.z.get();
  return { x: cam.tx.get() + x * PPI * z, y: cam.ty.get() + y * PPI * z };
}

/** Client (page) coordinates -> viewport-relative coordinates. */
export function clientToViewport(cx: number, cy: number) {
  const r = viewportEl.current?.getBoundingClientRect();
  return { x: cx - (r?.left ?? 0), y: cy - (r?.top ?? 0) };
}

export const clientToWorld = (cx: number, cy: number) => {
  const p = clientToViewport(cx, cy);
  return screenToWorld(p.x, p.y);
};

/** Inches that correspond to `px` screen pixels at the current zoom. */
export const screenPxToInches = (px: number) => px / (PPI * cam.z.get());

const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

let zoomAnim: { stop: () => void } | null = null;
let panAnim: { stop: () => void } | null = null;
let targetZoom: number | null = null;

export function stopCameraAnimations() {
  zoomAnim?.stop();
  panAnim?.stop();
  zoomAnim = null;
  panAnim = null;
  targetZoom = null;
}

/** Zoom about a viewport point. Animated zoom chains smoothly for consecutive wheel ticks. */
export function zoomAt(nextZ: number, sx: number, sy: number, animated = false) {
  panAnim?.stop();
  const z1 = clampZoom(nextZ);
  if (!animated) {
    zoomAnim?.stop();
    targetZoom = null;
    const z0 = cam.z.get();
    cam.tx.set(sx - ((sx - cam.tx.get()) * z1) / z0);
    cam.ty.set(sy - ((sy - cam.ty.get()) * z1) / z0);
    cam.z.set(z1);
    return;
  }
  zoomAnim?.stop();
  targetZoom = z1;
  const z0 = cam.z.get();
  const wx = (sx - cam.tx.get()) / z0;
  const wy = (sy - cam.ty.get()) / z0;
  zoomAnim = animate(z0, z1, {
    duration: 0.22,
    ease: [0.22, 1, 0.36, 1],
    onUpdate: (z) => {
      cam.z.set(z);
      cam.tx.set(sx - wx * z);
      cam.ty.set(sy - wy * z);
    },
    onComplete: () => {
      targetZoom = null;
    },
  });
}

/** The zoom value the camera is heading to (for chaining wheel steps). */
export const effectiveZoom = () => targetZoom ?? cam.z.get();

export function zoomBy(factor: number, animated = true) {
  const { w, h } = viewportSize();
  zoomAt(effectiveZoom() * factor, w / 2, h / 2, animated);
}

export function panBy(dx: number, dy: number) {
  cam.tx.set(cam.tx.get() + dx);
  cam.ty.set(cam.ty.get() + dy);
}

/** Momentum after a pan gesture (px/s). */
export function fling(vx: number, vy: number) {
  panAnim?.stop();
  const speed = Math.hypot(vx, vy);
  if (speed < 120) return;
  let last = 0;
  const tau = 0.32;
  const total = { x: vx * tau, y: vy * tau };
  panAnim = animate(0, 1, {
    duration: tau * 3.2,
    ease: (t) => 1 - Math.exp(-t * 3.2),
    onUpdate: (p) => {
      const d = p - last;
      last = p;
      panBy(total.x * d, total.y * d);
    },
  });
}

/** Screen space covered by floating panels, so fitting centres content in what's actually visible. */
export function chromeInsets() {
  const s = useUi.getState();
  const narrow = viewportSize().w < 760;
  return {
    left: s.leftPanel && !narrow ? 352 : 72,
    right: s.showInspector && s.selection.length && !narrow ? 312 : 16,
    top: 60,
    bottom: 16,
  };
}

/** Fit a world rect into the visible part of the viewport. */
export function fitRect(r: Rect, opts: { padding?: number; animated?: boolean; maxZoom?: number } = {}) {
  const { w: vw, h: vh } = viewportSize();
  const ins = chromeInsets();
  const w = Math.max(200, vw - ins.left - ins.right);
  const h = Math.max(200, vh - ins.top - ins.bottom);
  const pad = Math.min(opts.padding ?? 80, w / 6, h / 6);
  const z1 = clampZoom(Math.min((w - pad * 2) / (r.w * PPI), (h - pad * 2) / (r.h * PPI), opts.maxZoom ?? MAX_ZOOM));
  const tx1 = ins.left + w / 2 - (r.x + r.w / 2) * PPI * z1;
  const ty1 = ins.top + h / 2 - (r.y + r.h / 2) * PPI * z1;
  stopCameraAnimations();
  if (!opts.animated) {
    cam.z.set(z1);
    cam.tx.set(tx1);
    cam.ty.set(ty1);
    return;
  }
  const z0 = cam.z.get();
  const tx0 = cam.tx.get();
  const ty0 = cam.ty.get();
  zoomAnim = animate(0, 1, {
    type: 'spring',
    stiffness: 170,
    damping: 26,
    onUpdate: (p) => {
      // Interpolate zoom geometrically so the motion feels uniform.
      const z = z0 * Math.pow(z1 / z0, p);
      cam.z.set(z);
      cam.tx.set(tx0 + (tx1 - tx0) * p);
      cam.ty.set(ty0 + (ty1 - ty0) * p);
    },
  });
}

/** Coarse zoom level for image level-of-detail decisions (updates rarely). */
export const useZoomBucket = create<{ bucket: number }>(() => ({ bucket: 0 }));
const bucketOf = (z: number) => Math.round(Math.log2(z) * 2) / 2;
let lodTimer: ReturnType<typeof setTimeout> | null = null;
cam.z.on('change', (z) => {
  const b = bucketOf(z);
  if (b === useZoomBucket.getState().bucket) return;
  if (lodTimer) clearTimeout(lodTimer);
  lodTimer = setTimeout(() => useZoomBucket.setState({ bucket: bucketOf(cam.z.get()) }), 140);
});
useZoomBucket.setState({ bucket: bucketOf(cam.z.get()) });
export const zoomFromBucket = (b: number) => Math.pow(2, b);

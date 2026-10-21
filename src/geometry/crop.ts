import type { PhotoPlacement, Size } from '../model/types';

/**
 * Crop model (shared by the wall renderer and the crop editor, so both always agree):
 *   - The image is scaled to "cover" the opening, then multiplied by `zoom` (>= 1).
 *   - Anchor (ax, ay) uses CSS object-position semantics: the image point at fraction ax
 *     lines up with the opening point at fraction ax. Zoom scales about that same point.
 *   => left = ax * (openW - imgW * cover * zoom)   (always <= 0, so no gaps are possible)
 */

export const rotatedSize = (img: Size, rotate: number): Size => (rotate % 180 === 0 ? img : { w: img.h, h: img.w });

export const coverScale = (open: Size, img: Size) => Math.max(open.w / img.w, open.h / img.h);

export interface PlacedImage {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function placeImage(open: Size, img: Size, p: Pick<PhotoPlacement, 'ax' | 'ay' | 'zoom'>): PlacedImage {
  const s = coverScale(open, img) * Math.max(1, p.zoom);
  const width = img.w * s;
  const height = img.h * s;
  return { left: p.ax * (open.w - width), top: p.ay * (open.h - height), width, height };
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Pan the image by (dx, dy) in opening units; returns the new anchor. */
export function panAnchor(open: Size, img: Size, p: Pick<PhotoPlacement, 'ax' | 'ay' | 'zoom'>, dx: number, dy: number) {
  const cur = placeImage(open, img, p);
  const spanX = open.w - cur.width;
  const spanY = open.h - cur.height;
  const ax = Math.abs(spanX) < 1e-9 ? p.ax : clamp01((cur.left + dx) / spanX);
  const ay = Math.abs(spanY) < 1e-9 ? p.ay : clamp01((cur.top + dy) / spanY);
  return { ax, ay };
}

/**
 * Change zoom while keeping the image point under `focus` (opening units) fixed on screen
 * as far as the no-gap constraint allows.
 */
export function zoomAbout(open: Size, img: Size, p: Pick<PhotoPlacement, 'ax' | 'ay' | 'zoom'>, zoom: number, focus: { x: number; y: number }) {
  const z = Math.max(1, Math.min(8, zoom));
  const cur = placeImage(open, img, p);
  // Image-space fraction under the focus point.
  const fx = (focus.x - cur.left) / cur.width;
  const fy = (focus.y - cur.top) / cur.height;
  const next = placeImage(open, img, { ...p, zoom: z });
  const wantLeft = focus.x - fx * next.width;
  const wantTop = focus.y - fy * next.height;
  const spanX = open.w - next.width;
  const spanY = open.h - next.height;
  return {
    zoom: z,
    ax: Math.abs(spanX) < 1e-9 ? p.ax : clamp01(wantLeft / spanX),
    ay: Math.abs(spanY) < 1e-9 ? p.ay : clamp01(wantTop / spanY),
  };
}

/** Effective print resolution: image pixels per printed inch inside an opening measured in inches. */
export function effectivePpi(openInches: Size, imgPx: Size, zoom: number) {
  return 1 / (coverScale(openInches, imgPx) * Math.max(1, zoom));
}

export type PpiGrade = 'great' | 'good' | 'low';
export const ppiGrade = (ppi: number): PpiGrade => (ppi >= 240 ? 'great' : ppi >= 150 ? 'good' : 'low');

export const defaultPlacement = (assetId: string): PhotoPlacement => ({
  assetId,
  ax: 0.5,
  ay: 0.5,
  zoom: 1,
  rotate: 0,
  flipX: false,
  tone: 'none',
});

export const TONE_FILTER: Record<PhotoPlacement['tone'], string> = {
  none: 'none',
  bw: 'grayscale(1) contrast(1.08)',
  sepia: 'sepia(0.75) contrast(1.05) brightness(0.98)',
  warm: 'sepia(0.18) saturate(1.15) hue-rotate(-8deg)',
  cool: 'saturate(0.9) hue-rotate(12deg) brightness(1.02)',
};

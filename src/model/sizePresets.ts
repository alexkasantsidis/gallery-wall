import { CM_PER_IN } from './units';
import type { Size, Units } from './types';

export interface SizePreset {
  id: string;
  label: string;
  /** Portrait orientation (w <= h), inches. */
  w: number;
  h: number;
  system: 'us' | 'metric' | 'metal';
}

const us = (w: number, h: number, label = `${w}×${h}`): SizePreset => ({ id: `us-${w}x${h}`, label, w, h, system: 'us' });
const cm = (w: number, h: number, label = `${w}×${h}`): SizePreset => ({
  id: `cm-${w}x${h}`,
  label: `${label} cm`,
  w: w / CM_PER_IN,
  h: h / CM_PER_IN,
  system: 'metric',
});
const metal = (w: number, h: number): SizePreset => ({ id: `metal-${w}x${h}`, label: `${w}×${h}`, w, h, system: 'metal' });

export const US_PRESETS: SizePreset[] = [
  us(4, 6),
  us(5, 5),
  us(5, 7),
  us(6, 8),
  us(8, 8),
  us(8, 10),
  us(8.5, 11, '8½×11'),
  us(9, 12),
  us(10, 10),
  us(11, 14),
  us(12, 12),
  us(12, 16),
  us(12, 18),
  us(16, 16),
  us(16, 20),
  us(18, 24),
  us(20, 20),
  us(20, 24),
  us(20, 30),
  us(24, 30),
  us(24, 36),
  us(30, 40),
];

export const METRIC_PRESETS: SizePreset[] = [
  cm(10, 15),
  cm(13, 18),
  cm(15, 20),
  cm(18, 24),
  cm(20, 20),
  cm(20, 25),
  cm(21, 29.7, 'A4'),
  cm(24, 30),
  cm(30, 30),
  cm(29.7, 42, 'A3'),
  cm(30, 40),
  cm(40, 50),
  cm(42, 59.4, 'A2'),
  cm(50, 50),
  cm(50, 70),
  cm(59.4, 84.1, 'A1'),
  cm(61, 91),
  cm(70, 100),
];

export const METAL_PRESETS: SizePreset[] = [
  metal(8, 8),
  metal(8, 10),
  metal(8, 12),
  metal(10, 10),
  metal(11, 14),
  metal(12, 12),
  metal(12, 18),
  metal(16, 20),
  metal(16, 24),
  metal(20, 30),
  metal(24, 36),
  metal(30, 40),
  metal(30, 45),
];

export function presetsFor(units: Units, presetSet: 'frame' | 'metal'): SizePreset[] {
  if (presetSet === 'metal') return units === 'cm' ? [...METAL_PRESETS, ...METRIC_PRESETS] : METAL_PRESETS;
  return units === 'cm' ? METRIC_PRESETS : US_PRESETS;
}

/** Sizes shown as quick tiles in the palette. */
export const PALETTE_SIZES_US = ['us-5x7', 'us-8x10', 'us-11x14', 'us-12x12', 'us-16x20', 'us-18x24', 'us-24x36'];
export const PALETTE_SIZES_CM = ['cm-13x18', 'cm-21x29.7', 'cm-30x40', 'cm-30x30', 'cm-40x50', 'cm-50x70', 'cm-61x91'];

export const ALL_PRESETS = [...US_PRESETS, ...METRIC_PRESETS, ...METAL_PRESETS];
export const presetById = (id: string) => ALL_PRESETS.find((p) => p.id === id);

/** Matching preset for an exact nominal size (either orientation), if any. */
export function matchPreset(size: Size, list: SizePreset[], eps = 0.02): SizePreset | null {
  for (const p of list) {
    if (
      (Math.abs(p.w - size.w) < eps && Math.abs(p.h - size.h) < eps) ||
      (Math.abs(p.h - size.w) < eps && Math.abs(p.w - size.h) < eps)
    )
      return p;
  }
  return null;
}

/** Standard mat openings that fit inside a nominal frame size with at least `minBorder` each side. */
export function matOpeningsFor(nominal: Size, units: Units, minBorder = 1): Size[] {
  const list = units === 'cm' ? METRIC_PRESETS : US_PRESETS;
  const portrait = nominal.w <= nominal.h;
  const out: Size[] = [];
  for (const p of list) {
    const w = portrait ? p.w : p.h;
    const h = portrait ? p.h : p.w;
    if (w <= nominal.w - 2 * minBorder && h <= nominal.h - 2 * minBorder) out.push({ w, h });
  }
  return out.slice(-3).reverse();
}

/** Choose the preset closest in aspect (and near a target area) to an image's aspect ratio. */
export function presetForAspect(aspect: number, list: SizePreset[], targetArea = 140): Size {
  let best: Size = { w: 8, h: 10 };
  let bestScore = Infinity;
  for (const p of list) {
    for (const [w, h] of [
      [p.w, p.h],
      [p.h, p.w],
    ]) {
      const a = w / h;
      const score = Math.abs(Math.log(a / aspect)) * 8 + Math.abs(Math.log((w * h) / targetArea));
      if (score < bestScore) {
        bestScore = score;
        best = { w, h };
      }
    }
  }
  return best;
}

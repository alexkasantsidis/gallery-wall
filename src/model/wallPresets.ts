import { CM_PER_IN } from './units';
import type { Inches, Units } from './types';

export interface WallPreset {
  id: string;
  name: string;
  /** Short hint shown under the name, e.g. "12′ × 8′". */
  w: Inches;
  h: Inches;
}

const ft = (f: number) => f * 12;
const cm = (c: number) => c / CM_PER_IN;

/** Common real-world wall sizes (width × ceiling height). */
export const US_WALL_PRESETS: WallPreset[] = [
  { id: 'hall', name: 'Hallway', w: ft(8), h: ft(8) },
  { id: 'bed-sm', name: 'Bedroom', w: ft(10), h: ft(8) },
  { id: 'living', name: 'Living room', w: ft(12), h: ft(8) },
  { id: 'living-lg', name: 'Large living', w: ft(16), h: ft(9) },
  { id: 'dining', name: 'Dining room', w: ft(14), h: ft(9) },
  { id: 'loft', name: 'Loft', w: ft(20), h: ft(12) },
  { id: 'stair', name: 'Stairwell', w: ft(12), h: ft(16) },
  { id: 'gallery', name: 'Gallery', w: ft(24), h: ft(12) },
];

export const METRIC_WALL_PRESETS: WallPreset[] = [
  { id: 'hall', name: 'Hallway', w: cm(240), h: cm(240) },
  { id: 'bed-sm', name: 'Bedroom', w: cm(300), h: cm(250) },
  { id: 'living', name: 'Living room', w: cm(360), h: cm(250) },
  { id: 'living-lg', name: 'Large living', w: cm(480), h: cm(270) },
  { id: 'dining', name: 'Dining room', w: cm(420), h: cm(270) },
  { id: 'loft', name: 'Loft', w: cm(600), h: cm(360) },
  { id: 'stair', name: 'Stairwell', w: cm(360), h: cm(480) },
  { id: 'gallery', name: 'Gallery', w: cm(720), h: cm(360) },
];

export const wallPresetsFor = (units: Units) => (units === 'cm' ? METRIC_WALL_PRESETS : US_WALL_PRESETS);

export const MIN_WALL_W: Inches = 24;
export const MIN_WALL_H: Inches = 48;
export const MAX_WALL: Inches = 1200;

export const matchWallPreset = (w: Inches, h: Inches, units: Units) =>
  wallPresetsFor(units).find((p) => Math.abs(p.w - w) < 0.05 && Math.abs(p.h - h) < 0.05) ?? null;

/** 144 -> 12′ ; 150 -> 12′ 6″ ; metric -> 3.6 m */
export function formatWallLength(v: Inches, units: Units): string {
  if (units === 'cm') {
    const m = Math.round(v * CM_PER_IN) / 100;
    return `${Number.isInteger(m * 10) ? m.toFixed(1) : m.toFixed(2)} m`;
  }
  const total = Math.round(v * 4) / 4;
  const f = Math.floor(total / 12);
  const i = Math.round((total - f * 12) * 4) / 4;
  if (!f) return `${i}″`;
  return i ? `${f}′ ${i}″` : `${f}′`;
}

/** Compact size for preset buttons: 12′ × 8′ or 3.6 × 2.5 m */
export function formatWallSize(w: Inches, h: Inches, units: Units): string {
  if (units === 'cm') return `${formatWallLength(w, 'cm').replace(' m', '')} × ${formatWallLength(h, 'cm')}`;
  return `${formatWallLength(w, 'in')} × ${formatWallLength(h, 'in')}`;
}

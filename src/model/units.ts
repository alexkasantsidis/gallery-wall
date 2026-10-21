import type { Inches, Units } from './types';

export const CM_PER_IN = 2.54;
/** World pixels per inch inside the camera layer (zoom 1 == 100%). */
export const PPI = 96;

export const toUnits = (inches: Inches, units: Units) => (units === 'cm' ? inches * CM_PER_IN : inches);
export const fromUnits = (value: number, units: Units): Inches => (units === 'cm' ? value / CM_PER_IN : value);

const FRACTIONS: Record<number, string> = {
  1: '⅛',
  2: '¼',
  3: '⅜',
  4: '½',
  5: '⅝',
  6: '¾',
  7: '⅞',
};

/** 10.25 -> 10¼ ; 3.5 -> 3½ (nearest ⅛"). */
export function formatInches(v: Inches): string {
  const sign = v < 0 ? '-' : '';
  const abs = Math.abs(v);
  let whole = Math.floor(abs);
  let eighths = Math.round((abs - whole) * 8);
  if (eighths === 8) {
    whole += 1;
    eighths = 0;
  }
  const frac = eighths ? FRACTIONS[eighths] : '';
  if (whole === 0 && frac) return `${sign}${frac}`;
  return `${sign}${whole}${frac}`;
}

export function formatCm(v: Inches): string {
  const cm = v * CM_PER_IN;
  const r = Math.round(cm * 10) / 10;
  return Number.isInteger(r) ? `${r}` : r.toFixed(1);
}

/** A single length with its unit suffix: 11¼″ or 28.6 cm */
export function formatLength(v: Inches, units: Units): string {
  return units === 'cm' ? `${formatCm(v)} cm` : `${formatInches(v)}″`;
}

/** A pair of lengths: 11×14 or 28×35.6 cm */
export function formatSize(w: Inches, h: Inches, units: Units, suffix = true): string {
  if (units === 'cm') return `${formatCm(w)}×${formatCm(h)}${suffix ? ' cm' : ''}`;
  return `${formatInches(w)}×${formatInches(h)}${suffix ? '″' : ''}`;
}

/** Increment used for free (non-preset) resize snapping. */
export const stepFor = (units: Units): Inches => (units === 'cm' ? 0.5 / CM_PER_IN : 0.25);

export const roundTo = (v: number, step: number) => Math.round(v / step) * step;

/** Parse user input like "11", "11.25", "11 1/4", "11¼", "28.5" in the given units. */
export function parseLength(input: string, units: Units): Inches | null {
  const s = input.trim().replace(/[″"]|cm|in/gi, '').trim();
  if (!s) return null;
  const uni: Record<string, number> = { '⅛': 0.125, '¼': 0.25, '⅜': 0.375, '½': 0.5, '⅝': 0.625, '¾': 0.75, '⅞': 0.875 };
  let total = 0;
  let matched = false;
  for (const part of s.split(/\s+/)) {
    const m = part.match(/^(\d*\.?\d*)([⅛¼⅜½⅝¾⅞])?$/);
    const frac = part.match(/^(\d+)\/(\d+)$/);
    if (frac) {
      total += Number(frac[1]) / Number(frac[2]);
      matched = true;
    } else if (m && (m[1] || m[2])) {
      total += (m[1] ? Number(m[1]) : 0) + (m[2] ? uni[m[2]] : 0);
      matched = true;
    } else return null;
  }
  if (!matched || !Number.isFinite(total)) return null;
  return fromUnits(total, units);
}

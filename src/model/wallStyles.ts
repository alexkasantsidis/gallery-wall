import type { FurnitureKind, WallTexture } from './types';

export const PAINT_SWATCHES: { name: string; color: string }[] = [
  { name: 'Gallery White', color: '#f3f1ec' },
  { name: 'Warm White', color: '#efe8dc' },
  { name: 'Greige', color: '#d8d0c3' },
  { name: 'Mushroom', color: '#bfb3a3' },
  { name: 'Sage', color: '#b7bfa6' },
  { name: 'Eucalyptus', color: '#8f9e8b' },
  { name: 'Dusty Blue', color: '#9fb0bd' },
  { name: 'Navy', color: '#2b3a4f' },
  { name: 'Forest', color: '#2f4136' },
  { name: 'Terracotta', color: '#c27a5a' },
  { name: 'Blush', color: '#e7cfc4' },
  { name: 'Ochre', color: '#c9a25b' },
  { name: 'Oxblood', color: '#5e2b2b' },
  { name: 'Charcoal', color: '#3a3a3c' },
  { name: 'Ink', color: '#1f2023' },
];

export const TEXTURES: { id: WallTexture; name: string; kind: 'paint' | 'texture' | 'wallpaper' }[] = [
  { id: 'none', name: 'Flat paint', kind: 'paint' },
  { id: 'plaster', name: 'Plaster', kind: 'texture' },
  { id: 'limewash', name: 'Limewash', kind: 'texture' },
  { id: 'concrete', name: 'Concrete', kind: 'texture' },
  { id: 'brick', name: 'Brick', kind: 'texture' },
  { id: 'woodslat', name: 'Wood slat', kind: 'texture' },
  { id: 'boardbatten', name: 'Board & batten', kind: 'texture' },
  { id: 'wainscot', name: 'Wainscoting', kind: 'texture' },
  { id: 'stripes', name: 'Stripes', kind: 'wallpaper' },
  { id: 'grasscloth', name: 'Grasscloth', kind: 'wallpaper' },
  { id: 'geometric', name: 'Geometric', kind: 'wallpaper' },
  { id: 'botanical', name: 'Botanical', kind: 'wallpaper' },
];

export const FURNITURE_PRESETS: { type: FurnitureKind; name: string; w: number; h: number; color: string; floor: boolean }[] = [
  { type: 'sofa', name: 'Sofa', w: 84, h: 34, color: '#8a8f86', floor: true },
  { type: 'console', name: 'Console table', w: 48, h: 30, color: '#a47c55', floor: true },
  { type: 'sideboard', name: 'Sideboard', w: 66, h: 32, color: '#6e4d34', floor: true },
  { type: 'bed', name: 'Bed + headboard', w: 64, h: 48, color: '#c9c2b6', floor: true },
  { type: 'armchair', name: 'Armchair', w: 32, h: 36, color: '#b07a52', floor: true },
  { type: 'desk', name: 'Desk', w: 54, h: 30, color: '#3c3c3e', floor: true },
  { type: 'plant', name: 'Floor plant', w: 24, h: 60, color: '#5f7d55', floor: true },
  { type: 'lamp', name: 'Floor lamp', w: 16, h: 62, color: '#2d2d2f', floor: true },
  { type: 'tv', name: 'TV 65″', w: 57, h: 33, color: '#111112', floor: false },
  { type: 'switch', name: 'Light switch', w: 2.75, h: 4.5, color: '#f2f2f0', floor: false },
  { type: 'outlet', name: 'Outlet', w: 2.75, h: 4.5, color: '#f2f2f0', floor: false },
];

/** Approximate colour of a black-body light source, used to tint the wall lighting overlay. */
export function kelvinToRgb(k: number): [number, number, number] {
  const t = k / 100;
  let r: number;
  let g: number;
  let b: number;
  if (t <= 66) {
    r = 255;
    g = 99.47 * Math.log(t) - 161.12;
    b = t <= 19 ? 0 : 138.52 * Math.log(t - 10) - 305.04;
  } else {
    r = 329.7 * Math.pow(t - 60, -0.1332);
    g = 288.12 * Math.pow(t - 60, -0.0755);
    b = 255;
  }
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return [c(r), c(g), c(b)];
}

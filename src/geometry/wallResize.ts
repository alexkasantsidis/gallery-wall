import type { Inches, WallDoc } from '../model/types';
import { itemRect } from './frameGeometry';
import { MAX_WALL, MIN_WALL_H, MIN_WALL_W } from '../model/wallPresets';

export interface WallResizeResult {
  dx: Inches;
  dy: Inches;
  /** Ids of items that no longer fit fully on the wall. */
  outside: string[];
}

/**
 * Resize the wall in place (works on an immer draft).
 *
 * All geometry is in real inches, so art never changes size: only the wall does. Items are
 * shifted so the arrangement keeps its height above the floor (y is measured from the ceiling,
 * so a taller wall would otherwise lift everything and leave furniture floating) and stays
 * centred horizontally. The eye line is stored from the floor and needs no adjustment.
 */
export function resizeWallDoc(d: WallDoc, width: Inches, height: Inches): WallResizeResult {
  const w = Math.min(MAX_WALL, Math.max(MIN_WALL_W, width));
  const h = Math.min(MAX_WALL, Math.max(MIN_WALL_H, height));
  const dx = (w - d.wall.width) / 2;
  const dy = h - d.wall.height;
  d.wall.width = w;
  d.wall.height = h;
  for (const it of Object.values(d.items)) {
    it.x += dx;
    it.y += dy;
  }
  const photo = d.wall.style.photo;
  if (photo) {
    photo.x += dx;
    photo.y += dy;
  }
  const outside: string[] = [];
  for (const it of Object.values(d.items)) {
    const r = itemRect(it);
    const eps = 0.01;
    if (r.x < -eps || r.y < -eps || r.x + r.w > w + eps || r.y + r.h > h + eps) outside.push(it.id);
  }
  return { dx, dy, outside };
}

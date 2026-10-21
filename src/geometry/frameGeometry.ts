import { styleById, type FrameStyleDef } from '../model/frameStyles';
import type { FrameItem, Item, Rect, Size } from '../model/types';

export interface FrameMetrics {
  style: FrameStyleDef;
  face: number;
  lip: number;
  /** outer = nominal + 2 * inset */
  inset: number;
  outer: Size;
  /** Inset of the art box (the area inside the moulding, or inside the float gap) from the outer edge. */
  artInset: number;
}

export function frameMetrics(item: FrameItem, nominal: Size = item.nominal): FrameMetrics {
  const style = styleById(item.styleId);
  const face = style.face === 0 ? 0 : (item.moulding ?? style.face);
  const lip = style.face === 0 ? 0 : style.lip;
  const inset = face - lip;
  return {
    style,
    face,
    lip,
    inset,
    outer: { w: nominal.w + 2 * inset, h: nominal.h + 2 * inset },
    artInset: face + Math.max(0, -lip),
  };
}

/** Outer bounding rect of any item in wall inches. */
export function itemRect(item: Item): Rect {
  if (item.kind === 'furniture') return { x: item.x, y: item.y, w: item.w, h: item.h };
  const { outer } = frameMetrics(item);
  return { x: item.x, y: item.y, w: outer.w, h: outer.h };
}

export interface MatLayout {
  /** Opening (window) rect relative to the art box, in inches. */
  opening: Rect;
  /** Whether the opening is pinned by fixed borders (resizes with the frame) or fixed-size and centred. */
  mode: 'uniform' | 'opening';
  borders: { top: number; right: number; bottom: number; left: number };
}

/** Where the photo window sits inside the art box. */
export function matLayout(item: FrameItem, art: Size): MatLayout | null {
  const m = item.mat;
  if (!m.enabled) return null;
  if (m.mode === 'opening' && m.opening && m.opening.w < art.w - 0.25 && m.opening.h < art.h - 0.25) {
    const left = (art.w - m.opening.w) / 2;
    const top = Math.max(0.1, (art.h - m.opening.h - m.bottomWeight) / 2);
    return {
      mode: 'opening',
      opening: { x: left, y: top, w: m.opening.w, h: m.opening.h },
      borders: { top, left, right: left, bottom: art.h - top - m.opening.h },
    };
  }
  const w = Math.min(m.width, art.w / 2 - 0.5, art.h / 2 - 0.5);
  const bottom = w + Math.min(m.bottomWeight, art.h - 2 * w - 1);
  return {
    mode: 'uniform',
    opening: { x: w, y: w, w: art.w - 2 * w, h: art.h - w - bottom },
    borders: { top: w, left: w, right: w, bottom },
  };
}

/** The region photos are placed in (opening if matted, otherwise the whole art box), relative to the outer frame. */
export function contentRect(item: FrameItem): Rect {
  const met = frameMetrics(item);
  const art = { w: met.outer.w - 2 * met.artInset, h: met.outer.h - 2 * met.artInset };
  const mat = matLayout(item, art);
  if (!mat) return { x: met.artInset, y: met.artInset, w: art.w, h: art.h };
  return { x: met.artInset + mat.opening.x, y: met.artInset + mat.opening.y, w: mat.opening.w, h: mat.opening.h };
}

export const unionRect = (rects: Rect[]): Rect | null => {
  if (!rects.length) return null;
  let x1 = Infinity;
  let y1 = Infinity;
  let x2 = -Infinity;
  let y2 = -Infinity;
  for (const r of rects) {
    x1 = Math.min(x1, r.x);
    y1 = Math.min(y1, r.y);
    x2 = Math.max(x2, r.x + r.w);
    y2 = Math.max(y2, r.y + r.h);
  }
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
};

export const rectsIntersect = (a: Rect, b: Rect) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

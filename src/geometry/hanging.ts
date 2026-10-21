import type { FrameItem, WallDoc } from '../model/types';
import { itemRect } from './frameGeometry';

export interface Nail {
  /** Wall coordinates (from top-left). */
  x: number;
  y: number;
  fromLeft: number;
  fromFloor: number;
}

export interface HangSpec {
  item: FrameItem;
  index: number;
  nails: Nail[];
  rect: { x: number; y: number; w: number; h: number };
}

/** Nail positions for a frame, given where its hanger sits. */
export function nailsFor(item: FrameItem, wallHeight: number): Nail[] {
  const r = itemRect(item);
  const y = r.y + item.hanger.drop;
  const mk = (x: number): Nail => ({ x, y, fromLeft: x, fromFloor: wallHeight - y });
  if (item.hanger.kind === 'd-rings') return [mk(r.x + item.hanger.ringInset), mk(r.x + r.w - item.hanger.ringInset)];
  return [mk(r.x + r.w / 2)];
}

/** Frames in hanging order: left to right, top to bottom within columns. */
export function hangingPlan(doc: WallDoc): HangSpec[] {
  const frames = doc.order.map((id) => doc.items[id]).filter((i): i is FrameItem => !!i && i.kind === 'frame');
  frames.sort((a, b) => {
    const ra = itemRect(a);
    const rb = itemRect(b);
    const ca = ra.x + ra.w / 2;
    const cb = rb.x + rb.w / 2;
    return Math.abs(ca - cb) > 4 ? ca - cb : ra.y - rb.y;
  });
  return frames.map((item, index) => ({ item, index: index + 1, nails: nailsFor(item, doc.wall.height), rect: itemRect(item) }));
}

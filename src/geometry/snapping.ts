import type { Rect, Size } from '../model/types';
import type { SizePreset } from '../model/sizePresets';
import { roundTo } from '../model/units';

export interface Guide {
  axis: 'x' | 'y';
  /** Position of the line on its axis (x for vertical lines). */
  pos: number;
  from: number;
  to: number;
}

export interface GapChip {
  axis: 'x' | 'y';
  /** Start and end along the measured axis, and the cross-axis position for the chip. */
  a: number;
  b: number;
  cross: number;
  equal: boolean;
}

export interface SnapTargets {
  rects: Rect[];
  wall: { width: number; height: number };
  /** Eye line in wall-top coordinates (y), if shown. */
  eyeY: number | null;
}

interface AxisCandidate {
  value: number;
  /** Rects that produce this value (for drawing guides). */
  sources: Rect[];
  kind: 'align' | 'gap';
  gapChip?: GapChip[];
}

const EPS = 1e-6;

function alignValues(targets: SnapTargets, axis: 'x' | 'y'): AxisCandidate[] {
  const out: AxisCandidate[] = [];
  for (const r of targets.rects) {
    const s = axis === 'x' ? r.x : r.y;
    const l = axis === 'x' ? r.w : r.h;
    out.push({ value: s, sources: [r], kind: 'align' }, { value: s + l / 2, sources: [r], kind: 'align' }, { value: s + l, sources: [r], kind: 'align' });
  }
  const span = axis === 'x' ? targets.wall.width : targets.wall.height;
  const wallRect: Rect = { x: 0, y: 0, w: targets.wall.width, h: targets.wall.height };
  out.push({ value: span / 2, sources: [wallRect], kind: 'align' });
  if (axis === 'y' && targets.eyeY != null) out.push({ value: targets.eyeY, sources: [], kind: 'align' });
  return out;
}

const overlapsOn = (a: Rect, b: Rect, axis: 'x' | 'y') =>
  axis === 'x' ? a.y < b.y + b.h && a.y + a.h > b.y : a.x < b.x + b.w && a.x + a.w > b.x;

/** Gaps that already exist between neighbouring rects along an axis. */
export function existingGaps(rects: Rect[], axis: 'x' | 'y'): number[] {
  const gaps: number[] = [];
  for (const a of rects) {
    let best = Infinity;
    for (const b of rects) {
      if (a === b || !overlapsOn(a, b, axis)) continue;
      const g = axis === 'x' ? b.x - (a.x + a.w) : b.y - (a.y + a.h);
      if (g > 0.05 && g < best) best = g;
    }
    if (best < 60) gaps.push(best);
  }
  return gaps;
}

/** Snap one axis of a moving box. Returns the offset to add and the guides/chips to show. */
function snapAxis(box: Rect, targets: SnapTargets, axis: 'x' | 'y', threshold: number) {
  const start = axis === 'x' ? box.x : box.y;
  const len = axis === 'x' ? box.w : box.h;
  const edges = [start, start + len / 2, start + len];
  let best: { delta: number; cand: AxisCandidate; edge: number } | null = null;

  for (const cand of alignValues(targets, axis)) {
    for (let i = 0; i < 3; i++) {
      const d = cand.value - edges[i];
      if (Math.abs(d) <= threshold && (!best || Math.abs(d) < Math.abs(best.delta) - EPS)) best = { delta: d, cand, edge: i };
    }
  }

  // Equal spacing: neighbours that overlap on the cross axis.
  const neighbours = targets.rects.filter((r) => overlapsOn(box, r, axis));
  let before: Rect | null = null;
  let after: Rect | null = null;
  for (const r of neighbours) {
    const rs = axis === 'x' ? r.x : r.y;
    const re = rs + (axis === 'x' ? r.w : r.h);
    if (re <= start + len / 2 && (!before || re > (axis === 'x' ? before.x + before.w : before.y + before.h))) before = r;
    if (rs >= start + len / 2 && (!after || rs < (axis === 'x' ? after.x : after.y))) after = r;
  }
  const endOf = (r: Rect) => (axis === 'x' ? r.x + r.w : r.y + r.h);
  const startOf = (r: Rect) => (axis === 'x' ? r.x : r.y);
  const gaps = existingGaps(targets.rects, axis);
  const gapCands: { delta: number; chips: GapChip[] }[] = [];
  const cross = (r: Rect) => (axis === 'x' ? Math.max(r.y, box.y) + Math.min(r.y + r.h, box.y + box.h) : Math.max(r.x, box.x) + Math.min(r.x + r.w, box.x + box.w)) / 2;
  if (before && after) {
    // Centre between two neighbours.
    const space = startOf(after) - endOf(before) - len;
    if (space > 0) {
      const target = endOf(before) + space / 2;
      gapCands.push({
        delta: target - start,
        chips: [
          { axis, a: endOf(before), b: target, cross: cross(before), equal: true },
          { axis, a: target + len, b: startOf(after), cross: cross(after), equal: true },
        ],
      });
    }
  }
  for (const g of gaps) {
    if (before) {
      const target = endOf(before) + g;
      gapCands.push({ delta: target - start, chips: [{ axis, a: endOf(before), b: target, cross: cross(before), equal: true }] });
    }
    if (after) {
      const target = startOf(after) - g - len;
      gapCands.push({ delta: target - start, chips: [{ axis, a: target + len, b: startOf(after), cross: cross(after), equal: true }] });
    }
  }
  let gapBest: { delta: number; chips: GapChip[] } | null = null;
  for (const c of gapCands) {
    if (Math.abs(c.delta) <= threshold && (!gapBest || Math.abs(c.delta) < Math.abs(gapBest.delta))) gapBest = c;
  }
  if (gapBest && (!best || Math.abs(gapBest.delta) < Math.abs(best.delta) - EPS)) {
    return { delta: gapBest.delta, guides: [] as Guide[], chips: gapBest.chips };
  }
  if (!best) return { delta: 0, guides: [] as Guide[], chips: [] as GapChip[] };

  const snapped: Rect = axis === 'x' ? { ...box, x: box.x + best.delta } : { ...box, y: box.y + best.delta };
  return { delta: best.delta, guides: guidesFor(snapped, best.cand.value, axis, targets), chips: [] as GapChip[] };
}

/** Guide line through `value`, spanning the moving box and every rect touching that line. */
function guidesFor(box: Rect, value: number, axis: 'x' | 'y', targets: SnapTargets): Guide[] {
  const touching = targets.rects.filter((r) => {
    const s = axis === 'x' ? r.x : r.y;
    const l = axis === 'x' ? r.w : r.h;
    return [s, s + l / 2, s + l].some((v) => Math.abs(v - value) < 0.01);
  });
  const all = [box, ...touching];
  if (axis === 'x') {
    const from = Math.min(...all.map((r) => r.y));
    const to = Math.max(...all.map((r) => r.y + r.h));
    const wallLine = Math.abs(value - targets.wall.width / 2) < 0.01;
    return [{ axis: 'x', pos: value, from: wallLine ? 0 : from, to: wallLine ? targets.wall.height : to }];
  }
  const from = Math.min(...all.map((r) => r.x));
  const to = Math.max(...all.map((r) => r.x + r.w));
  const fullWidth = Math.abs(value - targets.wall.height / 2) < 0.01 || (targets.eyeY != null && Math.abs(value - targets.eyeY) < 0.01);
  return [{ axis: 'y', pos: value, from: fullWidth ? 0 : from, to: fullWidth ? targets.wall.width : to }];
}

export function snapMove(box: Rect, targets: SnapTargets, threshold: number) {
  const sx = snapAxis(box, targets, 'x', threshold);
  const sy = snapAxis({ ...box, x: box.x + sx.delta }, targets, 'y', threshold);
  return { dx: sx.delta, dy: sy.delta, guides: [...sx.guides, ...sy.guides], chips: [...sx.chips, ...sy.chips] };
}

/** Snap a single moving edge value (resize) to alignment targets. */
export function snapEdge(value: number, axis: 'x' | 'y', box: Rect, targets: SnapTargets, threshold: number) {
  let best: AxisCandidate | null = null;
  let bestD = Infinity;
  for (const cand of alignValues(targets, axis)) {
    const d = Math.abs(cand.value - value);
    if (d <= threshold && d < bestD) {
      best = cand;
      bestD = d;
    }
  }
  if (!best) return { value, guides: [] as Guide[] };
  return { value: best.value, guides: guidesFor(box, best.value, axis, targets) };
}

export interface NominalSnap {
  size: Size;
  preset: SizePreset | null;
}

/**
 * Snap a nominal size while resizing. Corner drags snap both dimensions to the nearest preset
 * (either orientation); edge drags snap the moving dimension only to values that complete a
 * preset with the fixed dimension. Otherwise round to `step`.
 */
export function snapNominal(
  size: Size,
  presets: SizePreset[],
  threshold: number,
  step: number,
  moving: { w: boolean; h: boolean },
): NominalSnap {
  let best: { size: Size; preset: SizePreset; d: number } | null = null;
  for (const p of presets) {
    for (const [w, h] of [
      [p.w, p.h],
      [p.h, p.w],
    ]) {
      if (moving.w && moving.h) {
        const d = Math.max(Math.abs(w - size.w), Math.abs(h - size.h));
        if (d <= threshold && (!best || d < best.d)) best = { size: { w, h }, preset: p, d };
      } else if (moving.w) {
        if (Math.abs(h - size.h) > 0.02) continue;
        const d = Math.abs(w - size.w);
        if (d <= threshold && (!best || d < best.d)) best = { size: { w, h: size.h }, preset: p, d };
      } else if (moving.h) {
        if (Math.abs(w - size.w) > 0.02) continue;
        const d = Math.abs(h - size.h);
        if (d <= threshold && (!best || d < best.d)) best = { size: { w: size.w, h }, preset: p, d };
      }
    }
  }
  if (best) return { size: best.size, preset: best.preset };
  return {
    size: { w: moving.w ? roundTo(size.w, step) : size.w, h: moving.h ? roundTo(size.h, step) : size.h },
    preset: null,
  };
}

/** Live distance chips to the nearest neighbour on each side of a box. */
export function neighbourChips(box: Rect, rects: Rect[], maxDist = 30): GapChip[] {
  const chips: GapChip[] = [];
  const dirs: Array<{ axis: 'x' | 'y'; sign: 1 | -1 }> = [
    { axis: 'x', sign: -1 },
    { axis: 'x', sign: 1 },
    { axis: 'y', sign: -1 },
    { axis: 'y', sign: 1 },
  ];
  for (const { axis, sign } of dirs) {
    let best: { gap: number; r: Rect } | null = null;
    for (const r of rects) {
      if (!overlapsOn(box, r, axis)) continue;
      const gap =
        axis === 'x'
          ? sign > 0
            ? r.x - (box.x + box.w)
            : box.x - (r.x + r.w)
          : sign > 0
            ? r.y - (box.y + box.h)
            : box.y - (r.y + r.h);
      if (gap >= 0 && gap <= maxDist && (!best || gap < best.gap)) best = { gap, r };
    }
    if (!best) continue;
    const r = best.r;
    const cross =
      axis === 'x'
        ? (Math.max(r.y, box.y) + Math.min(r.y + r.h, box.y + box.h)) / 2
        : (Math.max(r.x, box.x) + Math.min(r.x + r.w, box.x + box.w)) / 2;
    const a = axis === 'x' ? (sign > 0 ? box.x + box.w : r.x + r.w) : sign > 0 ? box.y + box.h : r.y + r.h;
    chips.push({ axis, a, b: a + best.gap, cross, equal: false });
  }
  return chips;
}

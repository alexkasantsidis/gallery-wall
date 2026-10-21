import type { Rect } from '../model/types';
import { rectsIntersect } from './frameGeometry';

export type ArrangeMode = 'salon' | 'grid' | 'row';

export interface ArrangeInput {
  id: string;
  w: number;
  h: number;
}

export interface ArrangeOptions {
  mode: ArrangeMode;
  gap: number;
  /** Desired centre of the cluster in wall coordinates. */
  center: { x: number; y: number };
  seed: number;
  /** Preferred width/height of the overall cluster. */
  targetAspect?: number;
  /** Optional limits: the cluster is shifted so it stays inside these. */
  maxBottom?: number;
  minTop?: number;
}

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const bbox = (rs: Rect[]): Rect => {
  const x1 = Math.min(...rs.map((r) => r.x));
  const y1 = Math.min(...rs.map((r) => r.y));
  const x2 = Math.max(...rs.map((r) => r.x + r.w));
  const y2 = Math.max(...rs.map((r) => r.y + r.h));
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
};

/** Salon-style packing: biggest piece first, every next piece docked to an existing one. */
function salon(items: ArrangeInput[], gap: number, seed: number, aspect: number): Map<string, Rect> {
  const rnd = mulberry32(seed);
  const sorted = [...items].sort((a, b) => b.w * b.h - a.w * a.h);
  // Shuffle a little so each seed gives a different composition, but keep the anchor large.
  for (let i = 1; i < sorted.length - 1; i++) {
    if (rnd() < 0.45) [sorted[i], sorted[i + 1]] = [sorted[i + 1], sorted[i]];
  }
  const placed: Rect[] = [];
  const out = new Map<string, Rect>();
  const first = sorted[0];
  const r0 = { x: -first.w / 2, y: -first.h / 2, w: first.w, h: first.h };
  placed.push(r0);
  out.set(first.id, r0);

  for (const it of sorted.slice(1)) {
    let best: { r: Rect; score: number } | null = null;
    for (const p of placed) {
      const cands: Rect[] = [];
      const alongX = [p.x, p.x + (p.w - it.w) / 2, p.x + p.w - it.w, p.x + (p.w - it.w) * rnd()];
      const alongY = [p.y, p.y + (p.h - it.h) / 2, p.y + p.h - it.h, p.y + (p.h - it.h) * rnd()];
      for (const x of alongX) {
        cands.push({ x, y: p.y - gap - it.h, w: it.w, h: it.h });
        cands.push({ x, y: p.y + p.h + gap, w: it.w, h: it.h });
      }
      for (const y of alongY) {
        cands.push({ x: p.x - gap - it.w, y, w: it.w, h: it.h });
        cands.push({ x: p.x + p.w + gap, y, w: it.w, h: it.h });
      }
      for (const c of cands) {
        const grown = { x: c.x - gap + 0.01, y: c.y - gap + 0.01, w: c.w + 2 * gap - 0.02, h: c.h + 2 * gap - 0.02 };
        if (placed.some((q) => rectsIntersect(grown, q))) continue;
        const b = bbox([...placed, c]);
        const extent = Math.max(b.w, b.h * aspect);
        const cx = c.x + c.w / 2;
        const cy = c.y + c.h / 2;
        const centrePull = Math.hypot(cx - (b.x + b.w / 2), (cy - (b.y + b.h / 2)) * 1.2) * 0.15;
        // Reward edges that line up with existing pieces: salon walls read better with some order.
        let align = 0;
        for (const q of placed) {
          if (Math.abs(q.x - c.x) < 0.05 || Math.abs(q.x + q.w - c.x - c.w) < 0.05) align += 1;
          if (Math.abs(q.y - c.y) < 0.05 || Math.abs(q.y + q.h - c.y - c.h) < 0.05) align += 1;
        }
        const score = extent + centrePull - align * 0.8 + rnd() * 3;
        if (!best || score < best.score) best = { r: c, score };
      }
    }
    const r = best?.r ?? { x: bbox(placed).x + bbox(placed).w + gap, y: -it.h / 2, w: it.w, h: it.h };
    placed.push(r);
    out.set(it.id, r);
  }
  return out;
}

/** Rows of pieces whose centres sit on a shared line per row. */
function grid(items: ArrangeInput[], gap: number, aspect: number): Map<string, Rect> {
  const sorted = [...items].sort((a, b) => b.h - a.h);
  const area = items.reduce((s, i) => s + (i.w + gap) * (i.h + gap), 0);
  const targetW = Math.sqrt(area * aspect);
  const rows: ArrangeInput[][] = [[]];
  let rowW = 0;
  for (const it of sorted) {
    if (rowW > 0 && rowW + it.w > targetW) {
      rows.push([]);
      rowW = 0;
    }
    rows[rows.length - 1].push(it);
    rowW += it.w + gap;
  }
  const out = new Map<string, Rect>();
  let y = 0;
  for (const row of rows) {
    const h = Math.max(...row.map((i) => i.h));
    const w = row.reduce((s, i) => s + i.w, 0) + gap * (row.length - 1);
    let x = -w / 2;
    for (const it of row) {
      out.set(it.id, { x, y: y + (h - it.h) / 2, w: it.w, h: it.h });
      x += it.w + gap;
    }
    y += h + gap;
  }
  return out;
}

function row(items: ArrangeInput[], gap: number): Map<string, Rect> {
  const out = new Map<string, Rect>();
  const w = items.reduce((s, i) => s + i.w, 0) + gap * (items.length - 1);
  let x = -w / 2;
  for (const it of items) {
    out.set(it.id, { x, y: -it.h / 2, w: it.w, h: it.h });
    x += it.w + gap;
  }
  return out;
}

/** Returns the new top-left for each item id. */
export function arrange(items: ArrangeInput[], opts: ArrangeOptions): Record<string, { x: number; y: number }> {
  if (!items.length) return {};
  const aspect = opts.targetAspect ?? 1.5;
  const layout = opts.mode === 'salon' ? salon(items, opts.gap, opts.seed, aspect) : opts.mode === 'grid' ? grid(items, opts.gap, aspect) : row(items, opts.gap);
  const b = bbox([...layout.values()]);
  let dx = opts.center.x - (b.x + b.w / 2);
  let dy = opts.center.y - (b.y + b.h / 2);
  if (opts.maxBottom != null && b.y + b.h + dy > opts.maxBottom) dy = opts.maxBottom - (b.y + b.h);
  if (opts.minTop != null && b.y + dy < opts.minTop) dy = opts.minTop - b.y;
  const out: Record<string, { x: number; y: number }> = {};
  for (const [id, r] of layout) out[id] = { x: r.x + dx, y: r.y + dy };
  return out;
}

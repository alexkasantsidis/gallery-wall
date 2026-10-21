import { commit, getDoc } from './docStore';
import { ui, useUi, toast } from './uiStore';
import { newFrame, newFurniture, newId, gridContent, autoMatWidth } from '../model/defaults';
import type { FrameItem, FurnitureKind, Item, PhotoPlacement, Rect, Size, WallDoc } from '../model/types';
import { frameMetrics, itemRect, unionRect } from '../geometry/frameGeometry';
import { arrange, type ArrangeMode } from '../geometry/arrange';
import { defaultPlacement } from '../geometry/crop';
import { presetForAspect, presetsFor } from '../model/sizePresets';
import { styleById } from '../model/frameStyles';
import { ingest, type AssetMeta } from '../photos/assets';
import type { SnapTargets } from '../geometry/snapping';

export const selectedItems = (): Item[] => {
  const d = getDoc();
  return ui().selection.map((id) => d.items[id]).filter(Boolean);
};

export function snapTargets(exclude: Set<string>, doc: WallDoc = getDoc()): SnapTargets {
  const rects: Rect[] = [];
  for (const id of doc.order) {
    if (exclude.has(id)) continue;
    const it = doc.items[id];
    if (it && it.kind === 'frame') rects.push(itemRect(it));
  }
  return {
    rects,
    wall: { width: doc.wall.width, height: doc.wall.height },
    eyeY: doc.wall.showEyeLine ? doc.wall.height - doc.wall.eyeLine : null,
  };
}

/** Add a frame centred on a world point. */
export function addFrame(center: { x: number; y: number }, nominal: Size, styleId?: string): string {
  const doc = getDoc();
  const f = newFrame({ x: 0, y: 0, nominal, styleId: styleId ?? doc.prefs.defaultStyleId });
  const { outer } = frameMetrics(f);
  f.x = center.x - outer.w / 2;
  f.y = center.y - outer.h / 2;
  commit((d) => {
    d.items[f.id] = f;
    d.order.push(f.id);
  });
  ui().select([f.id]);
  return f.id;
}

export function addFurniture(type: FurnitureKind) {
  const doc = getDoc();
  const f = newFurniture(type, doc.wall.height);
  f.x = doc.wall.width / 2 - f.w / 2;
  commit((d) => {
    d.items[f.id] = f;
    d.order.unshift(f.id);
  });
  ui().select([f.id]);
}

export function deleteSelection() {
  const ids = ui().selection;
  if (!ids.length) return;
  commit((d) => {
    for (const id of ids) delete d.items[id];
    d.order = d.order.filter((x) => !ids.includes(x));
  });
  ui().select([]);
}

const cloneItem = (it: Item, dx: number, dy: number): Item => {
  const c = structuredClone(it) as Item;
  c.id = newId();
  c.x += dx;
  c.y += dy;
  c.locked = false;
  if (c.kind === 'frame' && c.content.kind === 'grid') for (const cell of c.content.cells) cell.id = newId();
  return c;
};

/** Duplicate the given ids (default: selection) and select the copies. */
export function duplicate(ids = ui().selection, offset = 2): string[] {
  const d0 = getDoc();
  const copies = ids.map((id) => d0.items[id]).filter(Boolean).map((it) => cloneItem(it, offset, offset));
  if (!copies.length) return [];
  commit((d) => {
    for (const c of copies) {
      d.items[c.id] = c;
      d.order.push(c.id);
    }
  });
  ui().select(copies.map((c) => c.id));
  return copies.map((c) => c.id);
}

let clipboard: Item[] = [];
export function copySelection() {
  clipboard = selectedItems().map((i) => structuredClone(i) as Item);
  if (clipboard.length) toast(`Copied ${clipboard.length} item${clipboard.length > 1 ? 's' : ''}`);
}
export function pasteClipboard() {
  if (!clipboard.length) return false;
  const copies = clipboard.map((it) => cloneItem(it, 3, 3));
  clipboard = copies.map((c) => structuredClone(c) as Item);
  commit((d) => {
    for (const c of copies) {
      d.items[c.id] = c;
      d.order.push(c.id);
    }
  });
  ui().select(copies.map((c) => c.id));
  return true;
}

export function reorder(where: 'front' | 'back' | 'forward' | 'backward') {
  const ids = ui().selection;
  if (!ids.length) return;
  commit((d) => {
    const set = new Set(ids);
    if (where === 'front') d.order = [...d.order.filter((x) => !set.has(x)), ...d.order.filter((x) => set.has(x))];
    else if (where === 'back') d.order = [...d.order.filter((x) => set.has(x)), ...d.order.filter((x) => !set.has(x))];
    else {
      const o = [...d.order];
      const step = where === 'forward' ? 1 : -1;
      const idxs = o.map((x, i) => (set.has(x) ? i : -1)).filter((i) => i >= 0);
      if (step > 0) idxs.reverse();
      for (const i of idxs) {
        const j = i + step;
        if (j < 0 || j >= o.length || set.has(o[j])) continue;
        [o[i], o[j]] = [o[j], o[i]];
      }
      d.order = o;
    }
  });
}

export function toggleLock() {
  const items = selectedItems();
  const lock = !items.every((i) => i.locked);
  commit((d) => {
    for (const it of items) d.items[it.id].locked = lock;
  });
}

/** Mutate frames while keeping each one's centre fixed (style/size changes alter the outer size). */
export function updateFrames(ids: string[], fn: (f: FrameItem) => void, key?: string) {
  commit(
    (d) => {
      for (const id of ids) {
        const f = d.items[id];
        if (!f || f.kind !== 'frame') continue;
        const before = itemRect(f);
        fn(f);
        const after = frameMetrics(f).outer;
        f.x = before.x + before.w / 2 - after.w / 2;
        f.y = before.y + before.h / 2 - after.h / 2;
      }
    },
    { key },
  );
}

export function setStyle(ids: string[], styleId: string) {
  const style = styleById(styleId);
  updateFrames(ids, (f) => {
    const prev = styleById(f.styleId);
    f.styleId = styleId;
    f.color = null;
    f.moulding = null;
    if (prev.defaultMat !== style.defaultMat) f.mat.enabled = style.defaultMat;
    if (prev.hanger.kind !== style.hanger.kind || prev.hanger.drop !== style.hanger.drop) {
      f.hanger.kind = style.hanger.kind;
      f.hanger.drop = style.hanger.drop;
    }
  });
  commit((d) => {
    d.prefs.defaultStyleId = styleId;
  }, { key: 'pref-style' });
}

export function rotateSelection() {
  const ids = selectedItems().filter((i) => i.kind === 'frame').map((i) => i.id);
  updateFrames(ids, (f) => {
    f.nominal = { w: f.nominal.h, h: f.nominal.w };
    if (f.mat.opening) f.mat.opening = { w: f.mat.opening.h, h: f.mat.opening.w };
    if (f.content.kind === 'grid') {
      const g = f.content;
      for (const c of g.cells) [c.r, c.c, c.rs, c.cs] = [c.c, c.r, c.cs, c.rs];
      [g.rows, g.cols] = [g.cols, g.rows];
      [g.rowSizes, g.colSizes] = [g.colSizes, g.rowSizes];
    }
  });
}

export function setNominal(id: string, size: Size, key = 'nominal') {
  updateFrames(
    [id],
    (f) => {
      f.nominal = { w: Math.max(1, size.w), h: Math.max(1, size.h) };
      if (f.mat.mode === 'uniform') f.mat.width = Math.min(f.mat.width, Math.min(size.w, size.h) / 2 - 0.75);
    },
    key,
  );
}

export function nudge(dx: number, dy: number) {
  const items = selectedItems().filter((i) => !i.locked);
  if (!items.length) return;
  commit(
    (d) => {
      for (const it of items) {
        d.items[it.id].x += dx;
        d.items[it.id].y += dy;
      }
    },
    { key: 'nudge' },
  );
}

export function selectAll() {
  useUi.getState().select([...getDoc().order]);
}

// ---------- arrange / align ----------

export function arrangeSelection(mode: ArrangeMode, seed = Math.floor(Math.random() * 1e9), gap = 2.5) {
  const doc = getDoc();
  let frames = selectedItems().filter((i): i is FrameItem => i.kind === 'frame' && !i.locked);
  if (frames.length < 2) frames = doc.order.map((id) => doc.items[id]).filter((i): i is FrameItem => i.kind === 'frame' && !i.locked);
  if (frames.length < 2) {
    toast('Add a few frames to arrange');
    return;
  }
  const rects = frames.map((f) => ({ id: f.id, ...itemRect(f) }));
  const bounds = unionRect(rects)!;
  const centerX = bounds.x + bounds.w / 2;
  // Keep clear of furniture below the cluster (gallery rule of thumb: 8-10″ above).
  const furniture = doc.order.map((id) => doc.items[id]).filter((i) => i.kind === 'furniture' && i.y + i.h >= doc.wall.height - 1);
  const under = furniture.filter((f) => {
    const r = itemRect(f);
    return r.x < bounds.x + bounds.w && r.x + r.w > bounds.x;
  });
  const maxBottom = under.length ? Math.min(...under.map((f) => f.y)) - 8 : doc.wall.height - 12;
  const anchorWidth = under.length ? Math.max(...under.map((f) => itemRect(f).w)) : 0;
  const pos = arrange(rects, {
    mode,
    gap,
    seed,
    center: { x: centerX, y: doc.wall.height - doc.wall.eyeLine },
    targetAspect: anchorWidth ? Math.max(1.4, anchorWidth / 40) : 1.5,
    maxBottom,
    minTop: 6,
  });
  commit((d) => {
    for (const [id, p] of Object.entries(pos)) {
      d.items[id].x = p.x;
      d.items[id].y = p.y;
    }
  });
  ui().select(frames.map((f) => f.id));
}

export type AlignKind = 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom';
export function alignSelection(kind: AlignKind) {
  const items = selectedItems().filter((i) => !i.locked);
  if (items.length < 2) return;
  const rects = items.map(itemRect);
  const b = unionRect(rects)!;
  commit((d) => {
    items.forEach((it, i) => {
      const r = rects[i];
      const t = d.items[it.id];
      if (kind === 'left') t.x = b.x;
      if (kind === 'right') t.x = b.x + b.w - r.w;
      if (kind === 'hcenter') t.x = b.x + b.w / 2 - r.w / 2;
      if (kind === 'top') t.y = b.y;
      if (kind === 'bottom') t.y = b.y + b.h - r.h;
      if (kind === 'vcenter') t.y = b.y + b.h / 2 - r.h / 2;
    });
  });
}

/** Equalise gaps along an axis, keeping the outermost items in place. */
export function distribute(axis: 'x' | 'y') {
  const items = selectedItems().filter((i) => !i.locked);
  if (items.length < 3) return;
  const rects = items.map((it) => ({ it, r: itemRect(it) }));
  rects.sort((a, b) => (axis === 'x' ? a.r.x - b.r.x : a.r.y - b.r.y));
  const first = rects[0].r;
  const last = rects[rects.length - 1].r;
  const span = axis === 'x' ? last.x + last.w - first.x : last.y + last.h - first.y;
  const total = rects.reduce((s, { r }) => s + (axis === 'x' ? r.w : r.h), 0);
  const gap = (span - total) / (rects.length - 1);
  commit((d) => {
    let cur = axis === 'x' ? first.x : first.y;
    for (const { it, r } of rects) {
      if (axis === 'x') d.items[it.id].x = cur;
      else d.items[it.id].y = cur;
      cur += (axis === 'x' ? r.w : r.h) + gap;
    }
  });
}

// ---------- photos & grids ----------

function placePhoto(f: FrameItem, cellId: string | null, p: PhotoPlacement | null) {
  if (f.content.kind === 'single' || cellId == null || cellId === 'single') {
    if (f.content.kind === 'single') f.content.photo = p;
    else if (f.content.cells[0]) f.content.cells[0].photo = p;
    return;
  }
  const cell = f.content.cells.find((c) => c.id === cellId);
  if (cell) cell.photo = p;
}

export function setPhoto(itemId: string, cellId: string | null, p: PhotoPlacement | null, key?: string) {
  commit(
    (d) => {
      const f = d.items[itemId];
      if (f?.kind === 'frame') placePhoto(f, cellId, p);
    },
    { key },
  );
}

export function getPhoto(f: FrameItem, cellId: string | null): PhotoPlacement | null {
  if (f.content.kind === 'single') return f.content.photo;
  if (!cellId || cellId === 'single') return f.content.cells[0]?.photo ?? null;
  return f.content.cells.find((c) => c.id === cellId)?.photo ?? null;
}

export function setGrid(itemId: string, rows: number, cols: number) {
  commit((d) => {
    const f = d.items[itemId];
    if (f?.kind !== 'frame') return;
    if (rows === 1 && cols === 1) {
      const first = f.content.kind === 'grid' ? f.content.cells.find((c) => c.photo)?.photo ?? null : f.content.photo;
      f.content = { kind: 'single', photo: first };
    } else {
      const gutter = f.content.kind === 'grid' ? f.content.gutter : Math.max(0.375, Math.min(f.nominal.w, f.nominal.h) * 0.04);
      f.content = gridContent(rows, cols, gutter, f.content);
    }
  });
}

async function ingestMany(files: File[], loadingId?: string) {
  if (loadingId) useUi.setState((s) => ({ loading: { ...s.loading, [loadingId]: true } }));
  try {
    const out: AssetMeta[] = [];
    for (const f of files) {
      try {
        out.push(await ingest(f));
      } catch (err) {
        console.error(err);
        toast(`Couldn't read ${f.name || 'that image'}`);
      }
    }
    return out;
  } finally {
    if (loadingId)
      useUi.setState((s) => {
        const l = { ...s.loading };
        delete l[loadingId];
        return { loading: l };
      });
  }
}

const imageFiles = (files: File[]) => files.filter((f) => f.type.startsWith('image/') || /\.(heic|heif|jpe?g|png|webp|avif|gif)$/i.test(f.name));

/** Fill a frame (or a specific cell / the empty cells of a grid) with photos. */
export async function fillFrame(itemId: string, cellId: string | null, files: File[]) {
  const imgs = imageFiles(files);
  if (!imgs.length) return;
  const metas = await ingestMany(imgs, itemId);
  if (!metas.length) return;
  commit((d) => {
    const f = d.items[itemId];
    if (f?.kind !== 'frame') return;
    if (f.content.kind === 'single') {
      f.content.photo = defaultPlacement(metas[0].id);
      return;
    }
    const cells = f.content.cells;
    let start = cellId ? cells.findIndex((c) => c.id === cellId) : -1;
    if (start >= 0) {
      cells[start].photo = defaultPlacement(metas[0].id);
      metas.shift();
      start++;
    }
    for (const m of metas) {
      const empty = cells.find((c) => !c.photo);
      if (!empty) break;
      empty.photo = defaultPlacement(m.id);
    }
  });
}

/** Drop photos on empty wall: one new frame per photo, sized to the closest real-world preset. */
export async function framesFromPhotos(files: File[], at: { x: number; y: number }) {
  const imgs = imageFiles(files);
  if (!imgs.length) return;
  const metas = await ingestMany(imgs);
  const doc = getDoc();
  const style = styleById(doc.prefs.defaultStyleId);
  const presets = presetsFor(doc.prefs.units, style.presetSet);
  const created: FrameItem[] = [];
  let cx = at.x;
  for (const m of metas) {
    const nominal = presetForAspect(m.w / m.h, presets, 150);
    const f = newFrame({ x: 0, y: 0, nominal, styleId: style.id });
    f.mat.width = autoMatWidth(nominal);
    f.content = { kind: 'single', photo: defaultPlacement(m.id) };
    const outer = frameMetrics(f).outer;
    f.x = cx - outer.w / 2;
    f.y = at.y - outer.h / 2;
    cx += outer.w + 3;
    created.push(f);
  }
  commit((d) => {
    for (const f of created) {
      d.items[f.id] = f;
      d.order.push(f.id);
    }
  });
  ui().select(created.map((f) => f.id));
}

/** Resize a frame's nominal size to the preset that best matches its photo. */
export function fitFrameToPhoto(itemId: string, meta: { w: number; h: number }, rotate: number) {
  const doc = getDoc();
  const f = doc.items[itemId];
  if (f?.kind !== 'frame') return;
  const style = styleById(f.styleId);
  const [w, h] = rotate % 180 ? [meta.h, meta.w] : [meta.w, meta.h];
  const size = presetForAspect(w / h, presetsFor(doc.prefs.units, style.presetSet), f.nominal.w * f.nominal.h);
  setNominal(itemId, size, 'fit');
  updateFrames([itemId], (fr) => {
    const p = getPhoto(fr, null);
    if (p) {
      p.ax = 0.5;
      p.ay = 0.5;
      p.zoom = 1;
    }
    if (fr.mat.mode === 'opening') fr.mat.mode = 'uniform';
  });
}

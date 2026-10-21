import { nanoid } from 'nanoid';
import { styleById } from './frameStyles';
import { FURNITURE_PRESETS } from './wallStyles';
import type { FrameItem, FurnitureItem, FurnitureKind, GridContent, GridCell, MatSpec, Size, WallDoc, WallStyle } from './types';

export const newId = () => nanoid(10);

export const defaultMat = (enabled: boolean): MatSpec => ({
  enabled,
  mode: 'uniform',
  width: 2,
  opening: null,
  bottomWeight: 0,
  color: '#f7f5f0',
  double: { enabled: false, reveal: 0.25, color: '#1d1d1f' },
});

/** Mat width that looks right for a frame of this size. */
export const autoMatWidth = (n: Size) => {
  const m = Math.min(n.w, n.h);
  return m <= 6 ? 0.75 : m <= 9 ? 1.25 : m <= 13 ? 2 : m <= 20 ? 2.5 : 3;
};

export function newFrame(p: { x: number; y: number; nominal: Size; styleId: string; name?: string }): FrameItem {
  const style = styleById(p.styleId);
  const mat = defaultMat(style.defaultMat);
  mat.width = autoMatWidth(p.nominal);
  return {
    kind: 'frame',
    id: newId(),
    name: p.name ?? '',
    x: p.x,
    y: p.y,
    nominal: { ...p.nominal },
    styleId: style.id,
    color: null,
    moulding: null,
    mat,
    content: { kind: 'single', photo: null },
    hanger: { kind: style.hanger.kind, drop: style.hanger.drop, ringInset: 1.5 },
    glare: true,
    locked: false,
  };
}

export function newFurniture(type: FurnitureKind, wallHeight: number, x?: number): FurnitureItem {
  const preset = FURNITURE_PRESETS.find((f) => f.type === type)!;
  const y = preset.floor ? wallHeight - preset.h : type === 'tv' ? wallHeight - 60 - preset.h / 2 : wallHeight - 46;
  return {
    kind: 'furniture',
    id: newId(),
    type,
    name: preset.name,
    x: x ?? 20,
    y,
    w: preset.w,
    h: preset.h,
    color: preset.color,
    locked: false,
  };
}

export function gridContent(rows: number, cols: number, gutter = 0.5, old?: GridContent | { kind: 'single'; photo: GridCell['photo'] }): GridContent {
  const photos = old ? (old.kind === 'grid' ? old.cells.map((c) => c.photo) : [old.photo]) : [];
  const cells: GridCell[] = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) cells.push({ id: newId(), r, c, rs: 1, cs: 1, photo: photos[cells.length] ?? null });
  return {
    kind: 'grid',
    rows,
    cols,
    colSizes: Array(cols).fill(1),
    rowSizes: Array(rows).fill(1),
    gutter,
    gutterColor: null,
    cells,
  };
}

export const defaultWallStyle = (): WallStyle => ({
  color: '#efe8dc',
  texture: 'plaster',
  accent: '#d8cfc0',
  textureScale: 1,
  baseboard: { enabled: true, height: 5, color: '#f6f3ee' },
  floor: { color: '#9a7350', kind: 'wood' },
  light: { temperature: 3600, intensity: 0.45, angle: 330, vignette: 0.35, pictureLights: false },
  photo: null,
});

export function newWallDoc(name = 'My Gallery Wall'): WallDoc {
  const now = Date.now();
  return {
    id: newId(),
    name,
    createdAt: now,
    updatedAt: now,
    wall: { width: 132, height: 96, style: defaultWallStyle(), eyeLine: 57, showEyeLine: true },
    items: {},
    order: [],
    prefs: { units: 'in', snap: true, defaultStyleId: 'thin-black' },
  };
}

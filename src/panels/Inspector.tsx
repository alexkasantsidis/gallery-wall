import { AnimatePresence, motion } from 'motion/react';
import clsx from 'clsx';
import {
  RotateCw,
  Lock,
  Unlock,
  Copy,
  Trash2,
  Crop,
  ImagePlus,
  X,
  AlignStartVertical,
  AlignCenterVertical,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignCenterHorizontal,
  AlignEndHorizontal,
  AlignHorizontalSpaceAround,
  AlignVerticalSpaceAround,
  Shuffle,
  LayoutGrid,
  Rows3,
  Maximize2,
} from 'lucide-react';
import { useDoc, commit } from '../store/docStore';
import { useUi, ui } from '../store/uiStore';
import type { FrameItem, FurnitureItem, Item, MatSpec, Units } from '../model/types';
import { FRAME_STYLES, styleById } from '../model/frameStyles';
import { matchPreset, matOpeningsFor, presetsFor } from '../model/sizePresets';
import { frameMetrics, itemRect } from '../geometry/frameGeometry';
import { cellInches } from '../photos/CropEditor';
import { effectivePpi, ppiGrade, rotatedSize } from '../geometry/crop';
import { formatLength, formatSize } from '../model/units';
import { useAssetMeta, useAssetUrl } from '../photos/assets';
import { openFilePicker } from '../photos/filePicker';
import {
  updateFrames,
  setStyle,
  rotateSelection,
  toggleLock,
  duplicate,
  deleteSelection,
  setNominal,
  setGrid,
  fillFrame,
  setPhoto,
  getPhoto,
  alignSelection,
  distribute,
  arrangeSelection,
  fitFrameToPhoto,
} from '../store/actions';
import { Section, Row, Slider, Swatches, LengthInput, Toggle, Segmented, Button, IconButton, Popover } from '../components/ui';
import { FramePreview } from './FramePreview';
import { fitRect } from '../store/camera';

const MAT_COLORS = ['#ffffff', '#f7f5f0', '#efe8d8', '#e6dccb', '#d9d6cf', '#2a2a2c', '#141416', '#7d8a7a', '#2b3a4f'];

export function Inspector() {
  const selection = useUi((s) => s.selection);
  const items = useDoc((s) => s.doc.items);
  const show = useUi((s) => s.showInspector);
  const sel = selection.map((id) => items[id]).filter(Boolean) as Item[];
  const visible = show && sel.length > 0;
  return (
    <AnimatePresence>
      {visible && (
        <motion.aside
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 16 }}
          transition={{ type: 'spring', stiffness: 420, damping: 36 }}
          className="glass scroll-thin pointer-events-auto absolute top-16 right-4 bottom-4 w-[292px] overflow-y-auto rounded-2xl"
          onKeyDown={(e) => e.stopPropagation()}
        >
          {sel.length === 1 ? sel[0].kind === 'frame' ? <FrameInspector key={sel[0].id} frame={sel[0]} /> : <FurnitureInspector item={sel[0]} /> : <MultiInspector items={sel} />}
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

function Header({ title, sub, item }: { title: string; sub: string; item: Item }) {
  return (
    <div className="flex items-start justify-between gap-2 px-4 pt-4 pb-3">
      <div className="min-w-0">
        <input
          value={item.name}
          placeholder={title}
          onChange={(e) => commit((d) => void (d.items[item.id].name = e.target.value), { key: `name-${item.id}` })}
          className="w-full truncate bg-transparent text-[14px] font-semibold text-white outline-none placeholder:text-white"
        />
        <div className="text-[11.5px] text-ink-400">{sub}</div>
      </div>
      <div className="flex shrink-0 gap-0.5">
        {item.kind === 'frame' && (
          <IconButton label="Rotate 90° (R)" onClick={rotateSelection}>
            <RotateCw size={15} />
          </IconButton>
        )}
        <IconButton label={item.locked ? 'Unlock' : 'Lock'} onClick={toggleLock} active={item.locked}>
          {item.locked ? <Lock size={15} /> : <Unlock size={15} />}
        </IconButton>
        <IconButton label="Duplicate (Ctrl D)" onClick={() => duplicate()}>
          <Copy size={15} />
        </IconButton>
        <IconButton label="Delete (Del)" onClick={deleteSelection} className="hover:text-red-300">
          <Trash2 size={15} />
        </IconButton>
      </div>
    </div>
  );
}

function SizeSection({ frame, units }: { frame: FrameItem; units: Units }) {
  const style = styleById(frame.styleId);
  const presets = presetsFor(units, style.presetSet);
  const match = matchPreset(frame.nominal, presets);
  const met = frameMetrics(frame);
  const portrait = frame.nominal.w <= frame.nominal.h;
  return (
    <Section title={style.face === 0 ? 'Print size' : 'Frame size'} right={match && <span className="rounded-md bg-accent/20 px-1.5 py-0.5 text-[10.5px] font-semibold text-accent-soft">{match.label}</span>}>
      <div className="flex items-center gap-1.5">
        <LengthInput value={frame.nominal.w} units={units} min={1} onChange={(w) => setNominal(frame.id, { ...frame.nominal, w })} className="flex-1" ariaLabel="Width" />
        <span className="text-ink-500">×</span>
        <LengthInput value={frame.nominal.h} units={units} min={1} onChange={(h) => setNominal(frame.id, { ...frame.nominal, h })} className="flex-1" ariaLabel="Height" />
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {presets.slice(0, 18).map((p) => {
          const w = portrait ? p.w : p.h;
          const h = portrait ? p.h : p.w;
          const active = match?.id === p.id;
          return (
            <button
              key={p.id}
              onClick={() => setNominal(frame.id, { w, h }, 'preset')}
              className={clsx('rounded-md px-1.5 py-0.5 text-[10.5px] tabular-nums transition-colors', active ? 'bg-accent text-white' : 'bg-white/5 text-ink-300 hover:bg-white/10 hover:text-white')}
            >
              {p.label.replace(' cm', '')}
            </button>
          );
        })}
      </div>
      {met.inset !== 0 && <div className="mt-2 text-[11px] text-ink-500">Outer {formatSize(met.outer.w, met.outer.h, units)}</div>}
    </Section>
  );
}

function StyleSection({ frame }: { frame: FrameItem }) {
  const style = styleById(frame.styleId);
  return (
    <Section title="Style">
      <Popover.Root>
        <Popover.Trigger asChild>
          <button className="flex w-full items-center gap-3 rounded-xl bg-white/5 p-2 text-left transition-colors hover:bg-white/9">
            <div className="grid h-14 w-14 place-items-center">
              <FramePreview styleId={frame.styleId} color={frame.color} box={50} />
            </div>
            <div>
              <div className="text-[12.5px] font-medium text-white">{style.name}</div>
              <div className="text-[11px] text-ink-400">{style.group} · change</div>
            </div>
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content side="left" align="start" sideOffset={12} className="glass scroll-thin z-50 grid max-h-[70vh] w-[300px] grid-cols-3 gap-1.5 overflow-y-auto rounded-2xl p-2">
            {FRAME_STYLES.map((s) => (
              <Popover.Close asChild key={s.id}>
                <button
                  onClick={() => setStyle([frame.id], s.id)}
                  className={clsx('flex h-[88px] flex-col items-center justify-end gap-1 rounded-xl pb-1.5', s.id === frame.styleId ? 'bg-accent/18 ring-1 ring-accent/60' : 'hover:bg-white/8')}
                >
                  <div className="grid flex-1 place-items-center">
                    <FramePreview styleId={s.id} box={50} />
                  </div>
                  <span className="text-[10.5px] text-ink-300">{s.name}</span>
                </button>
              </Popover.Close>
            ))}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      {style.swatches.length > 0 && (
        <div className="mt-3">
          <Swatches colors={style.swatches} value={frame.color ?? style.color} onChange={(c) => updateFrames([frame.id], (f) => void (f.color = c), `color-${frame.id}`)} size={20} />
        </div>
      )}
      {style.face > 0 && (
        <Row label="Moulding width">
          <Slider value={frame.moulding ?? style.face} min={0.3} max={4} step={0.05} onChange={(v) => updateFrames([frame.id], (f) => void (f.moulding = v), `moulding-${frame.id}`)} className="w-32" />
        </Row>
      )}
      {(style.glass || style.variant === 'acrylic') && (
        <Row label="Glass reflection">
          <Toggle checked={frame.glare} onChange={(v) => updateFrames([frame.id], (f) => void (f.glare = v))} />
        </Row>
      )}
    </Section>
  );
}

function MatSection({ frame, units }: { frame: FrameItem; units: Units }) {
  const m = frame.mat;
  const set = (fn: (m: MatSpec) => void, key = `mat-${frame.id}`) => updateFrames([frame.id], (f) => fn(f.mat), key);
  const openings = matOpeningsFor(frame.nominal, units);
  return (
    <Section title="Mat" right={<Toggle checked={m.enabled} onChange={(v) => set((mm) => void (mm.enabled = v), 'mat-toggle')} />}>
      <AnimatePresence initial={false}>
        {m.enabled && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="space-y-1 overflow-hidden">
            <Row label="Opening">
              <Segmented
                size="sm"
                value={m.mode === 'opening' && m.opening ? `${m.opening.w}x${m.opening.h}` : 'uniform'}
                options={[{ value: 'uniform', label: 'Border' }, ...openings.map((o) => ({ value: `${o.w}x${o.h}`, label: formatSize(o.w, o.h, units, false) }))]}
                onChange={(v) =>
                  set((mm) => {
                    if (v === 'uniform') mm.mode = 'uniform';
                    else {
                      const [w, h] = v.split('x').map(Number);
                      mm.mode = 'opening';
                      mm.opening = { w, h };
                    }
                  }, 'mat-mode')
                }
              />
            </Row>
            {m.mode === 'uniform' && (
              <Row label="Border width">
                <LengthInput value={m.width} units={units} min={0.25} onChange={(v) => set((mm) => void (mm.width = v))} className="w-24" ariaLabel="Mat width" />
              </Row>
            )}
            <Row label="Bottom weight">
              <Slider value={m.bottomWeight} min={0} max={2} step={0.125} onChange={(v) => set((mm) => void (mm.bottomWeight = v))} className="w-28" />
            </Row>
            <div className="py-1">
              <Swatches colors={MAT_COLORS} value={m.color} onChange={(c) => set((mm) => void (mm.color = c))} size={18} />
            </div>
            <Row label="Double mat">
              <Toggle checked={m.double.enabled} onChange={(v) => set((mm) => void (mm.double.enabled = v), 'mat-double')} />
            </Row>
            {m.double.enabled && (
              <>
                <Row label="Reveal">
                  <Slider value={m.double.reveal} min={0.125} max={1} step={0.0625} onChange={(v) => set((mm) => void (mm.double.reveal = v))} className="w-28" />
                </Row>
                <Swatches colors={['#1d1d1f', '#b4492f', '#c9a24a', '#2b3a4f', '#5f7d55', '#ffffff']} value={m.double.color} onChange={(c) => set((mm) => void (mm.double.color = c))} size={18} />
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </Section>
  );
}

const GRIDS: Array<[number, number]> = [
  [1, 1],
  [1, 2],
  [2, 1],
  [2, 2],
  [1, 3],
  [3, 1],
  [2, 3],
  [3, 2],
  [3, 3],
];

function GridIcon({ r, c, active }: { r: number; c: number; active: boolean }) {
  return (
    <div className={clsx('grid h-7 w-7 gap-[2px] rounded-[5px] p-[3px] ring-1 transition-colors', active ? 'bg-accent/25 ring-accent' : 'ring-white/15 group-hover:ring-white/35')} style={{ gridTemplate: `repeat(${r}, 1fr) / repeat(${c}, 1fr)` }}>
      {Array.from({ length: r * c }, (_, i) => (
        <div key={i} className={clsx('rounded-[1.5px]', active ? 'bg-accent-soft' : 'bg-white/30')} />
      ))}
    </div>
  );
}

function ContentSection({ frame, units }: { frame: FrameItem; units: Units }) {
  const g = frame.content.kind === 'grid' ? frame.content : null;
  const rows = g?.rows ?? 1;
  const cols = g?.cols ?? 1;
  return (
    <Section title="Layout">
      <div className="flex flex-wrap gap-1">
        {GRIDS.map(([r, c]) => (
          <button key={`${r}${c}`} title={r * c === 1 ? 'Single photo' : `${r} × ${c} grid`} onClick={() => setGrid(frame.id, r, c)} className="group rounded-md p-0.5">
            <GridIcon r={r} c={c} active={rows === r && cols === c} />
          </button>
        ))}
      </div>
      {g && (
        <div className="mt-2 space-y-1">
          <Row label="Gutter">
            <LengthInput value={g.gutter} units={units} min={0} onChange={(v) => updateFrames([frame.id], (f) => void (f.content.kind === 'grid' && (f.content.gutter = v)), `gutter-${frame.id}`)} className="w-24" ariaLabel="Gutter" />
          </Row>
          {!frame.mat.enabled && (
            <Row label="Divider colour">
              <Swatches colors={['#101012', '#ffffff', '#f7f5f0']} value={g.gutterColor ?? '#101012'} onChange={(c) => updateFrames([frame.id], (f) => void (f.content.kind === 'grid' && (f.content.gutterColor = c)))} custom={false} size={18} />
            </Row>
          )}
          <GridTrackEditor frame={frame} />
        </div>
      )}
      <PhotoList frame={frame} />
    </Section>
  );
}

/** Drag the dividers to make uneven columns/rows. */
function GridTrackEditor({ frame }: { frame: FrameItem }) {
  if (frame.content.kind !== 'grid') return null;
  const g = frame.content;
  const W = 252;
  const aspect = frame.nominal.h / frame.nominal.w;
  const H = Math.min(180, W * aspect);
  const colX = (i: number) => (g.colSizes.slice(0, i).reduce((a, b) => a + b, 0) / g.colSizes.reduce((a, b) => a + b, 0)) * W;
  const rowY = (i: number) => (g.rowSizes.slice(0, i).reduce((a, b) => a + b, 0) / g.rowSizes.reduce((a, b) => a + b, 0)) * H;
  const startDrag = (axis: 'c' | 'r', i: number) => (e: React.PointerEvent) => {
    e.preventDefault();
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    const box = el.parentElement!.getBoundingClientRect();
    const sizes0 = axis === 'c' ? [...g.colSizes] : [...g.rowSizes];
    const total = sizes0.reduce((a, b) => a + b, 0);
    const move = (ev: PointerEvent) => {
      const frac = axis === 'c' ? (ev.clientX - box.left) / box.width : (ev.clientY - box.top) / box.height;
      const before = sizes0.slice(0, i - 1).reduce((a, b) => a + b, 0) / total;
      const pair = (sizes0[i - 1] + sizes0[i]) / total;
      const a = Math.min(pair - 0.06, Math.max(0.06, frac - before));
      const next = [...sizes0];
      next[i - 1] = a * total;
      next[i] = (pair - a) * total;
      updateFrames([frame.id], (f) => {
        if (f.content.kind !== 'grid') return;
        if (axis === 'c') f.content.colSizes = next;
        else f.content.rowSizes = next;
      }, `tracks-${frame.id}`);
    };
    const up = () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
  };
  return (
    <div className="pt-2">
      <div className="mb-1 text-[11px] text-ink-500">Drag dividers to resize cells</div>
      <div className="relative mx-auto rounded-md bg-white/5 ring-1 ring-white/10" style={{ width: W, height: H }}>
        {g.cells.map((c) => (
          <div
            key={c.id}
            className="absolute rounded-[3px] bg-white/8"
            style={{ left: colX(c.c) + 2, top: rowY(c.r) + 2, width: colX(c.c + c.cs) - colX(c.c) - 4, height: rowY(c.r + c.rs) - rowY(c.r) - 4 }}
          />
        ))}
        {g.colSizes.slice(1).map((_, k) => (
          <div key={`c${k}`} onPointerDown={startDrag('c', k + 1)} className="absolute top-0 bottom-0 w-3 -translate-x-1/2 cursor-col-resize touch-none" style={{ left: colX(k + 1) }}>
            <div className="mx-auto h-full w-[3px] rounded-full bg-accent/70 transition-colors hover:bg-accent" />
          </div>
        ))}
        {g.rowSizes.slice(1).map((_, k) => (
          <div key={`r${k}`} onPointerDown={startDrag('r', k + 1)} className="absolute right-0 left-0 h-3 -translate-y-1/2 cursor-row-resize touch-none" style={{ top: rowY(k + 1) }}>
            <div className="my-[4.5px] h-[3px] w-full rounded-full bg-accent/70 transition-colors hover:bg-accent" />
          </div>
        ))}
      </div>
    </div>
  );
}

function PhotoThumb({ frame, cellId, label }: { frame: FrameItem; cellId: string | null; label: string }) {
  const photo = getPhoto(frame, cellId);
  const meta = useAssetMeta(photo?.assetId);
  const units = useDoc((s) => s.doc.prefs.units);
  const cellIn = cellInches(frame, cellId);
  const ppi = photo && meta ? effectivePpi(cellIn, rotatedSize({ w: meta.w, h: meta.h }, photo.rotate), photo.zoom) : null;
  const grade = ppi ? ppiGrade(ppi) : null;
  return (
    <div className="flex items-center gap-2.5 rounded-xl bg-white/4 p-1.5">
      <motion.div layoutId={photo ? `photo-${frame.id}-${cellId ?? 'single'}` : undefined} className="h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-white/5" style={{ background: meta?.avgColor }}>
        {photo && <ThumbImg assetId={photo.assetId} rotate={photo.rotate} />}
      </motion.div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[11.5px] text-ink-200">{photo ? (meta?.name ?? 'Photo') : label}</div>
        {ppi != null ? (
          <div className={clsx('text-[10.5px]', grade === 'great' ? 'text-emerald-300' : grade === 'good' ? 'text-amber-200' : 'text-red-300')}>
            {Math.round(ppi)} ppi · {grade === 'great' ? 'sharp print' : grade === 'good' ? 'OK print' : 'may print soft'} · {formatSize(cellIn.w, cellIn.h, units)}
          </div>
        ) : (
          <div className="text-[10.5px] text-ink-500">Empty · {formatSize(cellIn.w, cellIn.h, units)}</div>
        )}
      </div>
      <div className="flex shrink-0">
        {photo && (
          <IconButton label="Crop & adjust" onClick={() => ui().set({ crop: { itemId: frame.id, cellId } })}>
            <Crop size={14} />
          </IconButton>
        )}
        <IconButton label={photo ? 'Replace photo' : 'Add photo'} onClick={() => openFilePicker((files) => fillFrame(frame.id, cellId, files), frame.content.kind === 'grid')}>
          <ImagePlus size={14} />
        </IconButton>
        {photo && (
          <IconButton label="Remove photo" onClick={() => setPhoto(frame.id, cellId, null)}>
            <X size={14} />
          </IconButton>
        )}
      </div>
    </div>
  );
}

function ThumbImg({ assetId, rotate }: { assetId: string; rotate: number }) {
  const url = useAssetUrl(assetId, 120, rotate);
  return url ? <img src={url} alt="" className="h-full w-full object-cover" draggable={false} /> : null;
}

function PhotoList({ frame }: { frame: FrameItem }) {
  const photo = getPhoto(frame, null);
  const meta = useAssetMeta(frame.content.kind === 'single' ? photo?.assetId : null);
  return (
    <div className="mt-3 space-y-1.5">
      {frame.content.kind === 'single' ? (
        <>
          <PhotoThumb frame={frame} cellId={null} label="No photo yet" />
          {photo && meta && (
            <Button variant="ghost" className="w-full" onClick={() => fitFrameToPhoto(frame.id, meta, photo.rotate)}>
              <Maximize2 size={13} /> Fit frame to photo
            </Button>
          )}
        </>
      ) : (
        frame.content.cells.map((c, i) => <PhotoThumb key={c.id} frame={frame} cellId={c.id} label={`Cell ${i + 1}`} />)
      )}
    </div>
  );
}

function HangerSection({ frame, units }: { frame: FrameItem; units: Units }) {
  const set = (fn: (f: FrameItem) => void, key = `hanger-${frame.id}`) => updateFrames([frame.id], fn, key);
  return (
    <Section title="Hanging hardware">
      <Segmented
        size="sm"
        value={frame.hanger.kind}
        options={[
          { value: 'wire', label: 'Wire' },
          { value: 'sawtooth', label: 'Sawtooth' },
          { value: 'd-rings', label: 'D-rings' },
        ]}
        onChange={(v) => set((f) => void (f.hanger.kind = v), 'hanger-kind')}
      />
      <Row label={frame.hanger.kind === 'wire' ? 'Taut wire below top' : 'Hanger below top'}>
        <LengthInput value={frame.hanger.drop} units={units} min={-12} onChange={(v) => set((f) => void (f.hanger.drop = v))} className="w-24" ariaLabel="Hanger drop" />
      </Row>
      {frame.hanger.kind === 'd-rings' && (
        <Row label="Ring inset from sides">
          <LengthInput value={frame.hanger.ringInset} units={units} min={0} onChange={(v) => set((f) => void (f.hanger.ringInset = v))} className="w-24" ariaLabel="Ring inset" />
        </Row>
      )}
    </Section>
  );
}

function PositionSection({ item, units }: { item: Item; units: Units }) {
  const wallH = useDoc((s) => s.doc.wall.height);
  const r = itemRect(item);
  const move = (dx: number, dy: number) => commit((d) => {
    d.items[item.id].x += dx;
    d.items[item.id].y += dy;
  }, { key: `pos-${item.id}` });
  return (
    <Section title="Position">
      <Row label="Left edge from wall">
        <LengthInput value={r.x} units={units} min={-500} onChange={(v) => move(v - r.x, 0)} className="w-24" ariaLabel="From left" />
      </Row>
      <Row label="Bottom edge from floor">
        <LengthInput value={wallH - r.y - r.h} units={units} min={-500} onChange={(v) => move(0, wallH - r.y - r.h - v)} className="w-24" ariaLabel="From floor" />
      </Row>
      <Row label="Centre from floor">
        <span className="text-[12px] text-ink-200 tabular-nums">{formatLength(wallH - r.y - r.h / 2, units)}</span>
      </Row>
    </Section>
  );
}

function FrameInspector({ frame }: { frame: FrameItem }) {
  const units = useDoc((s) => s.doc.prefs.units);
  const style = styleById(frame.styleId);
  return (
    <div>
      <Header title={style.name} sub={`${formatSize(frame.nominal.w, frame.nominal.h, units)} ${style.face === 0 ? 'print' : 'frame'}`} item={frame} />
      <SizeSection frame={frame} units={units} />
      <StyleSection frame={frame} />
      <ContentSection frame={frame} units={units} />
      {style.face > 0 || style.variant === 'clip' ? <MatSection frame={frame} units={units} /> : null}
      <HangerSection frame={frame} units={units} />
      <PositionSection item={frame} units={units} />
    </div>
  );
}

function FurnitureInspector({ item }: { item: FurnitureItem }) {
  const units = useDoc((s) => s.doc.prefs.units);
  const wallH = useDoc((s) => s.doc.wall.height);
  const set = (fn: (f: FurnitureItem) => void, key = `furn-${item.id}`) =>
    commit((d) => {
      const f = d.items[item.id];
      if (f.kind === 'furniture') fn(f);
    }, { key });
  return (
    <div>
      <Header title={item.name} sub="Furniture" item={item} />
      <Section title="Size">
        <div className="flex items-center gap-1.5">
          <LengthInput value={item.w} units={units} min={1} onChange={(w) => set((f) => void (f.w = w))} className="flex-1" ariaLabel="Width" />
          <span className="text-ink-500">×</span>
          <LengthInput value={item.h} units={units} min={1} onChange={(h) => set((f) => {
            const bottom = f.y + f.h;
            f.h = h;
            f.y = bottom - h;
          })} className="flex-1" ariaLabel="Height" />
        </div>
        <Button variant="soft" className="mt-2 w-full" onClick={() => set((f) => void (f.y = wallH - f.h), 'floor')}>
          Sit on floor
        </Button>
      </Section>
      <Section title="Colour">
        <Swatches colors={['#8a8f86', '#c9c2b6', '#b07a52', '#2f4136', '#2b3a4f', '#3c3c3e', '#e7cfc4', '#6e4d34']} value={item.color} onChange={(c) => set((f) => void (f.color = c))} />
      </Section>
      <PositionSection item={item} units={units} />
    </div>
  );
}

function MultiInspector({ items }: { items: Item[] }) {
  const frames = items.filter((i): i is FrameItem => i.kind === 'frame');
  const zoomToSel = () => {
    const rs = items.map(itemRect);
    const x1 = Math.min(...rs.map((r) => r.x));
    const y1 = Math.min(...rs.map((r) => r.y));
    const x2 = Math.max(...rs.map((r) => r.x + r.w));
    const y2 = Math.max(...rs.map((r) => r.y + r.h));
    fitRect({ x: x1, y: y1, w: x2 - x1, h: y2 - y1 }, { animated: true, padding: 140 });
  };
  return (
    <div>
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <div>
          <div className="text-[14px] font-semibold text-white">{items.length} selected</div>
          <div className="text-[11.5px] text-ink-400">{frames.length} frames</div>
        </div>
        <div className="flex">
          <IconButton label="Zoom to selection" onClick={zoomToSel}>
            <Maximize2 size={15} />
          </IconButton>
          <IconButton label="Duplicate" onClick={() => duplicate()}>
            <Copy size={15} />
          </IconButton>
          <IconButton label="Delete" onClick={deleteSelection} className="hover:text-red-300">
            <Trash2 size={15} />
          </IconButton>
        </div>
      </div>
      <Section title="Arrange">
        <div className="grid grid-cols-3 gap-1.5">
          <Button variant="soft" className="h-14 flex-col gap-1 text-[11px]" onClick={() => arrangeSelection('salon')}>
            <Shuffle size={16} /> Salon
          </Button>
          <Button variant="soft" className="h-14 flex-col gap-1 text-[11px]" onClick={() => arrangeSelection('grid')}>
            <LayoutGrid size={16} /> Grid
          </Button>
          <Button variant="soft" className="h-14 flex-col gap-1 text-[11px]" onClick={() => arrangeSelection('row')}>
            <Rows3 size={16} /> Row
          </Button>
        </div>
        <p className="mt-2 text-[11px] leading-snug text-ink-500">Salon packs pieces around the eye-level line with even 2½″ gaps. Press again for a new variation.</p>
      </Section>
      <Section title="Align & distribute">
        <div className="flex flex-wrap gap-0.5">
          <IconButton label="Align left" onClick={() => alignSelection('left')}><AlignStartVertical size={15} /></IconButton>
          <IconButton label="Align centres" onClick={() => alignSelection('hcenter')}><AlignCenterVertical size={15} /></IconButton>
          <IconButton label="Align right" onClick={() => alignSelection('right')}><AlignEndVertical size={15} /></IconButton>
          <IconButton label="Align top" onClick={() => alignSelection('top')}><AlignStartHorizontal size={15} /></IconButton>
          <IconButton label="Align middles" onClick={() => alignSelection('vcenter')}><AlignCenterHorizontal size={15} /></IconButton>
          <IconButton label="Align bottom" onClick={() => alignSelection('bottom')}><AlignEndHorizontal size={15} /></IconButton>
          <IconButton label="Distribute horizontally" onClick={() => distribute('x')} disabled={items.length < 3}><AlignHorizontalSpaceAround size={15} /></IconButton>
          <IconButton label="Distribute vertically" onClick={() => distribute('y')} disabled={items.length < 3}><AlignVerticalSpaceAround size={15} /></IconButton>
        </div>
      </Section>
      {frames.length > 0 && (
        <Section title="Style all">
          <div className="grid grid-cols-4 gap-1">
            {FRAME_STYLES.map((s) => (
              <button key={s.id} title={s.name} onClick={() => setStyle(frames.map((f) => f.id), s.id)} className="grid h-14 place-items-center rounded-lg hover:bg-white/8">
                <FramePreview styleId={s.id} box={40} />
              </button>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

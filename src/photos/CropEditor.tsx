import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { RotateCcw, RotateCw, FlipHorizontal2, Maximize2, Undo2, Check, ZoomIn, ZoomOut } from 'lucide-react';
import clsx from 'clsx';
import { useUi, ui } from '../store/uiStore';
import { useDoc } from '../store/docStore';
import { getPhoto, setPhoto, fitFrameToPhoto } from '../store/actions';
import { contentRect } from '../geometry/frameGeometry';
import { effectivePpi, panAnchor, placeImage, ppiGrade, rotatedSize, zoomAbout, TONE_FILTER } from '../geometry/crop';
import { useAssetMeta, useAssetUrl } from './assets';
import { Button, IconButton, Segmented, Slider } from '../components/ui';
import { formatSize } from '../model/units';
import type { FrameItem, PhotoPlacement, Size, Tone } from '../model/types';

/** Inches of the cell a photo occupies (grid-aware). */
export function cellInches(frame: FrameItem, cellId: string | null): Size {
  const content = contentRect(frame);
  if (frame.content.kind !== 'grid' || !cellId) return { w: content.w, h: content.h };
  const g = frame.content;
  const c = g.cells.find((x) => x.id === cellId);
  if (!c) return { w: content.w, h: content.h };
  const tw = g.colSizes.reduce((a, b) => a + b, 0);
  const th = g.rowSizes.reduce((a, b) => a + b, 0);
  const cw = g.colSizes.slice(c.c, c.c + c.cs).reduce((a, b) => a + b, 0) / tw;
  const ch = g.rowSizes.slice(c.r, c.r + c.rs).reduce((a, b) => a + b, 0) / th;
  return { w: (content.w - g.gutter * (g.cols - 1)) * cw + g.gutter * (c.cs - 1), h: (content.h - g.gutter * (g.rows - 1)) * ch + g.gutter * (c.rs - 1) };
}

export function CropEditor() {
  const target = useUi((s) => s.crop);
  const frame = useDoc((s) => (target ? s.doc.items[target.itemId] : undefined));
  const open = !!target && frame?.kind === 'frame' && !!getPhoto(frame, target.cellId);
  return <AnimatePresence>{open && <CropModal key={`${target!.itemId}-${target!.cellId}`} frame={frame as FrameItem} cellId={target!.cellId} />}</AnimatePresence>;
}

function CropModal({ frame, cellId }: { frame: FrameItem; cellId: string | null }) {
  const photo = getPhoto(frame, cellId)!;
  const initial = useRef<PhotoPlacement>(photo);
  const meta = useAssetMeta(photo.assetId);
  const url = useAssetUrl(photo.assetId, 2048, photo.rotate);
  const units = useDoc((s) => s.doc.prefs.units);
  const cell = cellInches(frame, cellId);
  const key = `crop-${frame.id}-${cellId}`;

  // Fit the opening into the available stage.
  const [stage, setStage] = useState({ w: window.innerWidth, h: window.innerHeight });
  useEffect(() => {
    const on = () => setStage({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  const maxW = Math.min(stage.w - 120, 900);
  const maxH = stage.h - 260;
  const s = Math.min(maxW / cell.w, maxH / cell.h);
  const box = { w: cell.w * s, h: cell.h * s };

  const img = meta ? rotatedSize({ w: meta.w, h: meta.h }, photo.rotate) : null;
  const placed = img ? placeImage(box, img, photo) : null;
  const ppi = img ? effectivePpi(cell, img, photo.zoom) : 0;
  const grade = ppiGrade(ppi);

  // The modal stays mounted during its exit animation; ignore input once it's closing.
  const closed = useRef(false);
  const update = (p: Partial<PhotoPlacement>) => !closed.current && setPhoto(frame.id, cellId, { ...photo, ...p }, key);
  const close = () => {
    closed.current = true;
    ui().set({ crop: null });
  };
  const cancel = () => {
    if (closed.current) return;
    setPhoto(frame.id, cellId, initial.current);
    close();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (closed.current) return;
      if (e.key === 'Escape') cancel();
      if (e.key === 'Enter') close();
      e.stopPropagation();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- gestures: drag pans, wheel / pinch zooms about the pointer ----
  const ptrs = useRef(new Map<number, { x: number; y: number }>());
  const last = useRef<{ x: number; y: number; dist?: number } | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const live = useRef(photo);
  live.current = photo;

  const localPoint = (cx: number, cy: number) => {
    const r = stageRef.current!.getBoundingClientRect();
    let x = cx - r.left;
    if (live.current.flipX) x = r.width - x;
    return { x, y: cy - r.top };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...ptrs.current.values()];
    last.current = pts.length === 2 ? { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2, dist: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) } : { x: e.clientX, y: e.clientY };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!ptrs.current.has(e.pointerId) || !img || !last.current) return;
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...ptrs.current.values()];
    const p = live.current;
    if (pts.length === 2 && last.current.dist) {
      const mid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const z = zoomAbout(box, img, p, (p.zoom * dist) / last.current.dist, localPoint(mid.x, mid.y));
      update(z);
      last.current = { ...mid, dist };
      return;
    }
    const dx = (e.clientX - last.current.x) * (p.flipX ? -1 : 1);
    const dy = e.clientY - last.current.y;
    last.current = { x: e.clientX, y: e.clientY };
    update(panAnchor(box, img, p, dx, dy));
  };
  const onPointerUp = (e: React.PointerEvent) => {
    ptrs.current.delete(e.pointerId);
    const pts = [...ptrs.current.values()];
    last.current = pts.length ? { x: pts[0].x, y: pts[0].y } : null;
  };

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (!img) return;
      const p = live.current;
      const factor = Math.exp(-e.deltaY * (e.ctrlKey ? 0.012 : 0.0018));
      update(zoomAbout(box, img, p, p.zoom * factor, localPoint(e.clientX, e.clientY)));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  });

  const imgStyle = useMemo(
    () =>
      placed
        ? { left: placed.left, top: placed.top, width: placed.width, height: placed.height, filter: TONE_FILTER[photo.tone] }
        : undefined,
    [placed?.left, placed?.top, placed?.width, placed?.height, photo.tone], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const rotate = (dir: 1 | -1) => update({ rotate: (((photo.rotate + dir * 90) % 360) + 360) % 360 as PhotoPlacement['rotate'], ax: 0.5, ay: 0.5 });

  return (
    <motion.div
      className="fixed inset-0 z-40 flex flex-col items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, pointerEvents: 'none' }}
      transition={{ duration: 0.18 }}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={close} />
      <motion.div
        layoutId={`photo-${frame.id}-${cellId ?? 'single'}`}
        className="relative"
        style={{ width: box.w, height: box.h }}
        transition={{ type: 'spring', stiffness: 300, damping: 32 }}
      >
        <div
          ref={stageRef}
          className="absolute inset-0 cursor-grab touch-none active:cursor-grabbing"
          style={{ transform: photo.flipX ? 'scaleX(-1)' : undefined }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {url && imgStyle && (
            <>
              {/* Context: the rest of the photo, dimmed */}
              <img src={url} alt="" draggable={false} className="pointer-events-none absolute max-w-none opacity-25" style={imgStyle} />
              <div className="absolute inset-0 overflow-hidden rounded-[2px] shadow-[0_0_0_1px_rgba(255,255,255,0.5),0_20px_60px_rgba(0,0,0,0.6)]">
                <img src={url} alt="" draggable={false} className="pointer-events-none absolute max-w-none" style={imgStyle} />
              </div>
            </>
          )}
        </div>
        {/* Rule of thirds */}
        <div className="pointer-events-none absolute inset-0">
          {[1, 2].map((i) => (
            <div key={`v${i}`} className="absolute top-0 bottom-0 w-px bg-white/35" style={{ left: `${(i * 100) / 3}%` }} />
          ))}
          {[1, 2].map((i) => (
            <div key={`h${i}`} className="absolute right-0 left-0 h-px bg-white/35" style={{ top: `${(i * 100) / 3}%` }} />
          ))}
        </div>
        <div className="absolute -top-9 left-0 flex w-full items-center justify-between text-[12px] text-ink-300">
          <span>
            {formatSize(cell.w, cell.h, units)} opening · drag to reposition, scroll or pinch to zoom
          </span>
          <span className={clsx('rounded-md px-2 py-0.5 font-medium', grade === 'great' ? 'bg-emerald-500/20 text-emerald-300' : grade === 'good' ? 'bg-amber-500/20 text-amber-200' : 'bg-red-500/20 text-red-300')}>
            {Math.round(ppi)} ppi · {grade === 'great' ? 'sharp' : grade === 'good' ? 'acceptable' : 'low resolution'}
          </span>
        </div>
      </motion.div>

      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 20, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 400, damping: 34, delay: 0.05 }}
        className="glass relative mt-6 flex flex-wrap items-center justify-center gap-2 rounded-2xl px-3 py-2"
      >
        <IconButton label="Zoom out" onClick={() => img && update(zoomAbout(box, img, photo, photo.zoom / 1.2, { x: box.w / 2, y: box.h / 2 }))}>
          <ZoomOut size={15} />
        </IconButton>
        <Slider value={photo.zoom} min={1} max={5} step={0.01} onChange={(z) => img && update(zoomAbout(box, img, photo, z, { x: box.w / 2, y: box.h / 2 }))} className="w-36" />
        <IconButton label="Zoom in" onClick={() => img && update(zoomAbout(box, img, photo, photo.zoom * 1.2, { x: box.w / 2, y: box.h / 2 }))}>
          <ZoomIn size={15} />
        </IconButton>
        <div className="mx-1 h-5 w-px bg-white/10" />
        <IconButton label="Rotate left" onClick={() => rotate(-1)}>
          <RotateCcw size={15} />
        </IconButton>
        <IconButton label="Rotate right" onClick={() => rotate(1)}>
          <RotateCw size={15} />
        </IconButton>
        <IconButton label="Flip" active={photo.flipX} onClick={() => update({ flipX: !photo.flipX })}>
          <FlipHorizontal2 size={15} />
        </IconButton>
        <div className="mx-1 h-5 w-px bg-white/10" />
        <Segmented<Tone>
          size="sm"
          value={photo.tone}
          options={[
            { value: 'none', label: 'Original' },
            { value: 'bw', label: 'B&W' },
            { value: 'sepia', label: 'Sepia' },
            { value: 'warm', label: 'Warm' },
            { value: 'cool', label: 'Cool' },
          ]}
          onChange={(tone) => update({ tone })}
        />
        <div className="mx-1 h-5 w-px bg-white/10" />
        {frame.content.kind === 'single' && meta && (
          <Button variant="ghost" onClick={() => fitFrameToPhoto(frame.id, meta, photo.rotate)} title="Resize the frame to the real-world size that best matches this photo">
            <Maximize2 size={14} /> Fit frame
          </Button>
        )}
        <Button variant="ghost" onClick={() => update({ ax: 0.5, ay: 0.5, zoom: 1 })}>
          <Undo2 size={14} /> Reset
        </Button>
        <Button variant="soft" onClick={cancel}>
          Cancel
        </Button>
        <Button variant="primary" onClick={close}>
          <Check size={14} /> Done
        </Button>
      </motion.div>
    </motion.div>
  );
}

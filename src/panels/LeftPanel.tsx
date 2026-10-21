import { useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Frame, Sofa, PaintRoller, Upload, Plus } from 'lucide-react';
import clsx from 'clsx';
import { useDoc, getDoc } from '../store/docStore';
import { ui, useUi } from '../store/uiStore';
import { FRAME_STYLES, STYLE_GROUPS, styleById } from '../model/frameStyles';
import { PALETTE_SIZES_CM, PALETTE_SIZES_US, METAL_PRESETS, presetById } from '../model/sizePresets';
import { FURNITURE_PRESETS } from '../model/wallStyles';
import { addFrame, addFurniture, framesFromPhotos, setStyle, selectedItems } from '../store/actions';
import { clientToWorld, viewportEl, screenToWorld, viewportSize, cam } from '../store/camera';
import { frameMetrics } from '../geometry/frameGeometry';
import { newFrame } from '../model/defaults';
import { FramePreview } from './FramePreview';
import { WallPanel } from './WallPanel';
import { openFilePicker } from '../photos/filePicker';
import { LengthInput, Button, Tip } from '../components/ui';
import { PPI, formatSize } from '../model/units';
import type { Size } from '../model/types';

const TABS = [
  { id: 'frames' as const, icon: Frame, label: 'Frames' },
  { id: 'furniture' as const, icon: Sofa, label: 'Furniture' },
  { id: 'wall' as const, icon: PaintRoller, label: 'Wall' },
];

export function LeftPanel() {
  const tab = useUi((s) => s.leftPanel);
  return (
    <div className="pointer-events-none absolute top-16 bottom-4 left-4 flex gap-2">
      <div className="glass pointer-events-auto flex h-fit flex-col gap-1 rounded-2xl p-1.5">
        {TABS.map((t) => (
          <Tip key={t.id} label={t.label} side="right">
            <button
              onClick={() => ui().set({ leftPanel: tab === t.id ? null : t.id })}
              className={clsx('grid h-10 w-10 place-items-center rounded-xl transition-colors', tab === t.id ? 'bg-accent/20 text-accent-soft' : 'text-ink-400 hover:bg-white/8 hover:text-white')}
            >
              <t.icon size={18} strokeWidth={1.7} />
            </button>
          </Tip>
        ))}
      </div>
      <AnimatePresence mode="wait">
        {tab && (
          <motion.div
            key={tab}
            initial={{ opacity: 0, x: -12, scale: 0.98 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -8, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 420, damping: 34 }}
            className="glass scroll-thin pointer-events-auto flex w-[272px] flex-col overflow-y-auto rounded-2xl"
          >
            {tab === 'frames' && <FramesTab />}
            {tab === 'furniture' && <FurnitureTab />}
            {tab === 'wall' && <WallPanel />}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function viewCenterWorld() {
  const { w, h } = viewportSize();
  return screenToWorld(w / 2, h / 2);
}

/** Drag a size tile from the palette onto the wall (or click to drop it in the middle of the view). */
function useTileDrag() {
  const [ghost, setGhost] = useState<{ x: number; y: number; w: number; h: number; styleId: string; nominal: Size } | null>(null);
  const start = useRef<{ x: number; y: number; moved: boolean } | null>(null);

  const onPointerDown = (e: React.PointerEvent, nominal: Size) => {
    const styleId = getDoc().prefs.defaultStyleId;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    start.current = { x: e.clientX, y: e.clientY, moved: false };
    const outer = frameMetrics(newFrame({ x: 0, y: 0, nominal, styleId })).outer;
    const z = cam.z.get();
    setGhost({ x: e.clientX, y: e.clientY, w: outer.w * PPI * z, h: outer.h * PPI * z, styleId, nominal });
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!start.current || !ghost) return;
    if (Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > 4) start.current.moved = true;
    setGhost({ ...ghost, x: e.clientX, y: e.clientY });
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const s = start.current;
    const g = ghost;
    start.current = null;
    setGhost(null);
    if (!s || !g) return;
    if (!s.moved) {
      addFrame(viewCenterWorld(), g.nominal);
      return;
    }
    const vp = viewportEl.current?.getBoundingClientRect();
    const overPanel = (document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null)?.closest('.glass');
    if (vp && !overPanel && e.clientX > vp.left && e.clientX < vp.right && e.clientY > vp.top && e.clientY < vp.bottom) addFrame(clientToWorld(e.clientX, e.clientY), g.nominal);
  };
  const ghostEl = ghost && start.current?.moved && (
    <div className="pointer-events-none fixed z-50" style={{ left: ghost.x - ghost.w / 2, top: ghost.y - ghost.h / 2, opacity: 0.85 }}>
      <FramePreview styleId={ghost.styleId} nominal={ghost.nominal} box={Math.max(ghost.w, ghost.h)} />
    </div>
  );
  return { onPointerDown, onPointerMove, onPointerUp, ghostEl };
}

function FramesTab() {
  const defaultStyleId = useDoc((s) => s.doc.prefs.defaultStyleId);
  const units = useDoc((s) => s.doc.prefs.units);
  const selCount = useUi((s) => s.selection.length);
  const style = styleById(defaultStyleId);
  const sizes = (style.presetSet === 'metal' && units === 'in' ? METAL_PRESETS.filter((_, i) => i % 2 === 0).map((p) => p.id) : units === 'cm' ? PALETTE_SIZES_CM : PALETTE_SIZES_US)
    .map((id) => presetById(id)!)
    .filter(Boolean);
  const drag = useTileDrag();
  const [custom, setCustom] = useState<Size>({ w: 10, h: 13 });

  const pickStyle = (id: string) => {
    const frames = selectedItems().filter((i) => i.kind === 'frame').map((i) => i.id);
    if (frames.length) setStyle(frames, id);
    else useDoc.getState().commit((d) => void (d.prefs.defaultStyleId = id), { key: 'pref-style' });
  };

  return (
    <div className="pb-3">
      <div className="px-4 pt-4 pb-2">
        <h2 className="text-[13px] font-semibold text-white">Add frames</h2>
        <p className="mt-0.5 text-[11.5px] leading-snug text-ink-400">Drag a size onto the wall, click to drop it in view, or double-click the wall.</p>
      </div>
      <div className="grid grid-cols-4 gap-1.5 px-3">
        {sizes.map((p) => (
          <button
            key={p.id}
            onPointerDown={(e) => drag.onPointerDown(e, { w: p.w, h: p.h })}
            onPointerMove={drag.onPointerMove}
            onPointerUp={drag.onPointerUp}
            className="group flex h-[74px] touch-none flex-col items-center justify-end gap-1 rounded-xl bg-white/4 pb-1.5 transition-colors hover:bg-white/9"
          >
            <div className="grid flex-1 place-items-center transition-transform group-hover:scale-110 group-active:scale-95">
              <FramePreview styleId={defaultStyleId} nominal={{ w: p.w, h: p.h }} box={8 + Math.sqrt(p.w * p.h) * 1.55} />
            </div>
            <span className="text-[10.5px] font-medium text-ink-300">{p.label.replace(' cm', '')}</span>
          </button>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-1.5 px-3">
        <LengthInput value={custom.w} units={units} onChange={(w) => setCustom((c) => ({ ...c, w }))} className="w-[76px]" min={1} ariaLabel="Custom width" />
        <span className="text-ink-500">×</span>
        <LengthInput value={custom.h} units={units} onChange={(h) => setCustom((c) => ({ ...c, h }))} className="w-[76px]" min={1} ariaLabel="Custom height" />
        <Button
          variant="soft"
          className="ml-auto px-2"
          onPointerDown={(e) => drag.onPointerDown(e, custom)}
          onPointerMove={drag.onPointerMove}
          onPointerUp={drag.onPointerUp}
          title={`Add ${formatSize(custom.w, custom.h, units)}`}
        >
          <Plus size={14} />
        </Button>
      </div>
      <div className="mt-3 px-3">
        <Button variant="primary" className="w-full" onClick={() => openFilePicker((files) => framesFromPhotos(files, viewCenterWorld()), true)}>
          <Upload size={14} /> Upload photos as frames
        </Button>
      </div>

      <div className="mt-4 px-4">
        <h2 className="text-[13px] font-semibold text-white">Frame style</h2>
        <p className="mt-0.5 text-[11.5px] text-ink-400">{selCount ? 'Applies to the selected frames' : 'Used for new frames'}</p>
      </div>
      {STYLE_GROUPS.map((g) => (
        <div key={g} className="mt-3 px-3">
          <div className="mb-1.5 px-1 text-[10px] font-semibold tracking-[0.08em] text-ink-500 uppercase">{g}</div>
          <div className="grid grid-cols-3 gap-1.5">
            {FRAME_STYLES.filter((s) => s.group === g).map((s) => (
              <motion.button
                key={s.id}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => pickStyle(s.id)}
                className={clsx('flex h-[92px] flex-col items-center justify-end gap-1.5 rounded-xl pb-1.5 transition-colors', s.id === defaultStyleId ? 'bg-accent/18 ring-1 ring-accent/60' : 'bg-white/4 hover:bg-white/8')}
              >
                <div className="grid flex-1 place-items-center">
                  <FramePreview styleId={s.id} box={54} />
                </div>
                <span className="px-1 text-center text-[10.5px] leading-tight text-ink-300">{s.name}</span>
              </motion.button>
            ))}
          </div>
        </div>
      ))}
      {drag.ghostEl}
    </div>
  );
}

function FurnitureTab() {
  return (
    <div className="pb-3">
      <div className="px-4 pt-4 pb-2">
        <h2 className="text-[13px] font-semibold text-white">Furniture & fixtures</h2>
        <p className="mt-0.5 text-[11.5px] leading-snug text-ink-400">Add pieces for scale. Floor pieces sit on the floor line; keep art 8–10″ above furniture.</p>
      </div>
      <div className="grid grid-cols-2 gap-1.5 px-3">
        {FURNITURE_PRESETS.map((f) => (
          <button key={f.type} onClick={() => addFurniture(f.type)} className="flex flex-col items-start rounded-xl bg-white/4 px-3 py-2.5 text-left transition-colors hover:bg-white/9">
            <span className="text-[12px] font-medium text-ink-200">{f.name}</span>
            <span className="text-[10.5px] text-ink-500">
              {f.w}″ × {f.h}″
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

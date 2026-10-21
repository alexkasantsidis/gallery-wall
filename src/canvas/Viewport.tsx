import { useEffect, useRef } from 'react';
import { animate, motion, useMotionTemplate } from 'motion/react';
import { useDoc, getDoc, commit } from '../store/docStore';
import { useUi, ui, clearOverlays } from '../store/uiStore';
import { registry } from '../store/registry';
import {
  cam,
  viewportEl,
  clientToViewport,
  clientToWorld,
  screenPxToInches,
  zoomAt,
  effectiveZoom,
  panBy,
  fling,
  stopCameraAnimations,
  fitRect,
} from '../store/camera';
import { PPI, formatSize, stepFor } from '../model/units';
import { frameMetrics, itemRect, rectsIntersect, unionRect } from '../geometry/frameGeometry';
import { snapMove, snapEdge, snapNominal, neighbourChips, type Guide } from '../geometry/snapping';
import { presetsFor, type SizePreset } from '../model/sizePresets';
import { addFrame, duplicate, snapTargets, fillFrame, framesFromPhotos, getPhoto } from '../store/actions';
import type { FrameItem, Rect, Size } from '../model/types';
import { ItemNode, type HandleDir } from './ItemNode';
import { WallSurface } from './WallSurface';
import { GuidesLayer } from './GuidesLayer';
import { openFilePicker } from '../photos/filePicker';
import { styleById } from '../model/frameStyles';

type Pt = { x: number; y: number };

type Gesture =
  | { kind: 'none' }
  | {
      kind: 'press' | 'move';
      pointerId: number;
      startClient: Pt;
      startWorld: Pt;
      ids: string[];
      starts: Map<string, Rect>;
      bbox0: Rect;
      clickedId: string;
      wasSelected: boolean;
      alt: boolean;
    }
  | {
      kind: 'resize';
      pointerId: number;
      id: string;
      dir: HandleDir;
      startWorld: Pt;
      r0: Rect;
      inset: number;
      nominal0: Size;
      isFrame: boolean;
      presets: SizePreset[];
      lastPreset: string | null;
      result: { rect: Rect; nominal: Size } | null;
    }
  | { kind: 'marquee'; pointerId: number; startWorld: Pt; base: string[]; moved: boolean }
  | { kind: 'pan'; pointerId: number; last: Pt; samples: { t: number; x: number; y: number }[] }
  | { kind: 'pinch'; dist0: number; z0: number; mid0: Pt; t0: Pt };

const DEFAULT_NEW: Record<'in' | 'cm', Size> = { in: { w: 8, h: 10 }, cm: { w: 20 / 2.54, h: 25 / 2.54 } };

function liveRect(id: string): Rect | null {
  const h = registry.get(id);
  if (!h) return null;
  return { x: h.x.get() / PPI, y: h.y.get() / PPI, w: h.w.get() / PPI, h: h.h.get() / PPI };
}

/** Put items back where the document says (cancelled gesture). */
function revertLive(ids: string[]) {
  const doc = getDoc();
  for (const id of ids) {
    const h = registry.get(id);
    const it = doc.items[id];
    if (!h || !it) continue;
    h.live.current = false;
    const r = itemRect(it);
    h.x.set(r.x * PPI);
    h.y.set(r.y * PPI);
    h.w.set(r.w * PPI);
    h.h.set(r.h * PPI);
  }
}

export function Viewport() {
  const ref = useRef<HTMLDivElement>(null);
  const order = useDoc((s) => s.doc.order);
  const items = useDoc((s) => s.doc.items);
  const wall = useDoc((s) => s.doc.wall);
  const spaceDown = useUi((s) => s.spaceDown);
  const panning = useUi((s) => s.panning);
  const tool = useUi((s) => s.tool);

  const transform = useMotionTemplate`translate3d(${cam.tx}px, ${cam.ty}px, 0) scale(${cam.z})`;
  const gesture = useRef<Gesture>({ kind: 'none' });
  const pointers = useRef(new Map<number, Pt & { type: string }>());

  // Register viewport, fit the wall on first mount.
  useEffect(() => {
    const el = ref.current!;
    viewportEl.current = el;
    const fit = () => {
      const d = getDoc();
      fitRect({ x: -4, y: -4, w: d.wall.width + 8, h: d.wall.height + 18 }, { padding: 90 });
    };
    let size = { w: el.clientWidth, h: el.clientHeight };
    if (size.w > 0) fit();
    // Fit once we first get a real size (e.g. opened in a background tab); afterwards keep the view centred on resize.
    const ro = new ResizeObserver(() => {
      const next = { w: el.clientWidth, h: el.clientHeight };
      if (next.w === 0 || next.h === 0) return;
      if (size.w === 0 || size.h === 0) fit();
      else panBy((next.w - size.w) / 2, (next.h - size.h) / 2);
      size = next;
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      viewportEl.current = null;
    };
  }, []);

  // Zoom-dependent CSS (counter-scaled UI) and the dot grid, without React renders.
  useEffect(() => {
    const el = ref.current!;
    let raf = 0;
    const update = () => {
      raf = 0;
      const z = cam.z.get();
      el.style.setProperty('--inv', String(1 / z));
      let step = 12 * PPI * z; // a dot every foot
      while (step < 14) step *= 2;
      while (step > 120) step /= 2;
      el.style.backgroundSize = `${step}px ${step}px`;
      el.style.backgroundPosition = `${cam.tx.get()}px ${cam.ty.get()}px`;
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    const unsub = [cam.z.on('change', schedule), cam.tx.on('change', schedule), cam.ty.on('change', schedule)];
    return () => unsub.forEach((u) => u());
  }, []);

  // Wheel / trackpad: scroll pans, ctrl/cmd + wheel (or pinch) zooms — like Obsidian Canvas.
  useEffect(() => {
    const el = ref.current!;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const p = clientToViewport(e.clientX, e.clientY);
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? el.clientHeight : 1;
      const dx = e.deltaX * unit;
      const dy = e.deltaY * unit;
      if (e.ctrlKey || e.metaKey) {
        const mouseLike = Math.abs(dy) >= 40 && Number.isInteger(e.deltaY);
        if (mouseLike) zoomAt(effectiveZoom() * (dy > 0 ? 1 / 1.25 : 1.25), p.x, p.y, true);
        else zoomAt(cam.z.get() * Math.exp(-dy * 0.0105), p.x, p.y);
      } else {
        stopCameraAnimations();
        if (e.shiftKey && !dx) panBy(-dy, 0);
        else panBy(-dx, -dy);
      }
    };
    // Safari trackpad pinch.
    let gz = 1;
    const onGestureStart = (e: any) => {
      e.preventDefault();
      gz = cam.z.get();
    };
    const onGestureChange = (e: any) => {
      e.preventDefault();
      const p = clientToViewport(e.clientX, e.clientY);
      zoomAt(gz * e.scale, p.x, p.y);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('gesturestart', onGestureStart as EventListener);
    el.addEventListener('gesturechange', onGestureChange as EventListener);
    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('gesturestart', onGestureStart as EventListener);
      el.removeEventListener('gesturechange', onGestureChange as EventListener);
    };
  }, []);

  // ---------- pointer state machine ----------

  const startPinch = () => {
    const g = gesture.current;
    if (g.kind === 'press' || g.kind === 'move') revertLive(g.ids);
    if (g.kind === 'resize') revertLive([g.id]);
    clearOverlays();
    const [a, b] = [...pointers.current.values()];
    const mid = clientToViewport((a.x + b.x) / 2, (a.y + b.y) / 2);
    gesture.current = { kind: 'pinch', dist0: Math.hypot(a.x - b.x, a.y - b.y), z0: cam.z.get(), mid0: mid, t0: { x: cam.tx.get(), y: cam.ty.get() } };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button === 2) return; // context menu
    stopCameraAnimations();
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY, type: e.pointerType });
    ref.current!.setPointerCapture(e.pointerId);
    const touches = [...pointers.current.values()].filter((p) => p.type === 'touch');
    if (touches.length >= 2) return startPinch();
    if (gesture.current.kind !== 'none') return;

    const target = e.target as HTMLElement;
    const startWorld = clientToWorld(e.clientX, e.clientY);
    const s = ui();

    if (e.button === 1 || s.spaceDown || s.tool === 'hand') {
      e.preventDefault();
      gesture.current = { kind: 'pan', pointerId: e.pointerId, last: { x: e.clientX, y: e.clientY }, samples: [] };
      s.set({ panning: true });
      return;
    }

    const handle = target.closest<HTMLElement>('[data-handle]');
    if (handle) {
      const id = handle.dataset.itemHandle!;
      const it = getDoc().items[id];
      if (!it) return;
      const r0 = itemRect(it);
      const isFrame = it.kind === 'frame';
      const doc = getDoc();
      gesture.current = {
        kind: 'resize',
        pointerId: e.pointerId,
        id,
        dir: handle.dataset.handle as HandleDir,
        startWorld,
        r0,
        isFrame,
        inset: isFrame ? frameMetrics(it as FrameItem).inset : 0,
        nominal0: isFrame ? { ...(it as FrameItem).nominal } : { w: r0.w, h: r0.h },
        presets: isFrame ? presetsFor(doc.prefs.units, styleById((it as FrameItem).styleId).presetSet) : [],
        lastPreset: null,
        result: null,
      };
      const h = registry.get(id);
      if (h) h.live.current = true;
      return;
    }

    const itemEl = target.closest<HTMLElement>('[data-item-id]');
    if (itemEl) {
      const id = itemEl.dataset.itemId!;
      const wasSelected = s.selection.includes(id);
      if (e.shiftKey) {
        s.toggle(id);
        if (wasSelected) return;
      } else if (!wasSelected) s.select([id]);
      const doc = getDoc();
      const ids = ui().selection.filter((x) => doc.items[x] && !doc.items[x].locked);
      const starts = new Map(ids.map((x) => [x, itemRect(doc.items[x])]));
      gesture.current = {
        kind: 'press',
        pointerId: e.pointerId,
        startClient: { x: e.clientX, y: e.clientY },
        startWorld,
        ids,
        starts,
        bbox0: unionRect([...starts.values()]) ?? { x: 0, y: 0, w: 0, h: 0 },
        clickedId: id,
        wasSelected,
        alt: e.altKey,
      };
      return;
    }

    // Empty canvas: one finger pans on touch (long-press opens the context menu); mouse/pen draws a selection box.
    if (e.pointerType === 'touch') {
      gesture.current = { kind: 'pan', pointerId: e.pointerId, last: { x: e.clientX, y: e.clientY }, samples: [] };
      return;
    }
    gesture.current = { kind: 'marquee', pointerId: e.pointerId, startWorld, base: e.shiftKey ? [...s.selection] : [], moved: false };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY, type: e.pointerType });
    const g = gesture.current;
    if (g.kind === 'pinch') {
      const pts = [...pointers.current.values()];
      if (pts.length < 2) return;
      const [a, b] = pts;
      const mid = clientToViewport((a.x + b.x) / 2, (a.y + b.y) / 2);
      const z = Math.min(6, Math.max(0.03, (g.z0 * Math.hypot(a.x - b.x, a.y - b.y)) / g.dist0));
      // Keep the world point under the initial midpoint under the current midpoint.
      cam.tx.set(mid.x - ((g.mid0.x - g.t0.x) * z) / g.z0);
      cam.ty.set(mid.y - ((g.mid0.y - g.t0.y) * z) / g.z0);
      cam.z.set(z);
      return;
    }
    if (g.kind === 'none' || ('pointerId' in g && g.pointerId !== e.pointerId)) return;
    const world = clientToWorld(e.clientX, e.clientY);
    const noSnap = e.ctrlKey || e.metaKey || !getDoc().prefs.snap;

    if (g.kind === 'pan') {
      const dx = e.clientX - g.last.x;
      const dy = e.clientY - g.last.y;
      panBy(dx, dy);
      g.last = { x: e.clientX, y: e.clientY };
      const t = performance.now();
      g.samples.push({ t, x: e.clientX, y: e.clientY });
      while (g.samples.length > 2 && t - g.samples[0].t > 90) g.samples.shift();
      if (!ui().panning) ui().set({ panning: true });
      return;
    }

    if (g.kind === 'press') {
      if (Math.hypot(e.clientX - g.startClient.x, e.clientY - g.startClient.y) < 3 || !g.ids.length) return;
      if (g.alt) {
        // Alt-drag duplicates: the copies move, the originals stay.
        const copies = duplicate(g.ids, 0);
        const starts = new Map<string, Rect>();
        copies.forEach((c, i) => starts.set(c, g.starts.get(g.ids[i])!));
        g.ids = copies;
        g.starts = starts;
      }
      (g as any).kind = 'move';
      for (const id of g.ids) {
        const h = registry.get(id);
        if (h) h.live.current = true;
      }
      ref.current!.classList.add('is-dragging');
    }

    if (g.kind === 'move') {
      let dx = world.x - g.startWorld.x;
      let dy = world.y - g.startWorld.y;
      const box = { ...g.bbox0, x: g.bbox0.x + dx, y: g.bbox0.y + dy };
      let guides: Guide[] = [];
      const targets = snapTargets(new Set(g.ids));
      let chips = [] as ReturnType<typeof neighbourChips>;
      if (!noSnap) {
        const s = snapMove(box, targets, screenPxToInches(8));
        dx += s.dx;
        dy += s.dy;
        guides = s.guides;
        chips = s.chips;
      }
      const snapped = { ...g.bbox0, x: g.bbox0.x + dx, y: g.bbox0.y + dy };
      if (!chips.length) chips = neighbourChips(snapped, targets.rects, 24);
      for (const id of g.ids) {
        const h = registry.get(id);
        const s0 = g.starts.get(id)!;
        if (!h) continue;
        h.x.set((s0.x + dx) * PPI);
        h.y.set((s0.y + dy) * PPI);
      }
      ui().set({ guides, chips, badge: null });
      return;
    }

    if (g.kind === 'resize') {
      const dx = world.x - g.startWorld.x;
      const dy = world.y - g.startWorld.y;
      const { r0, dir, inset } = g;
      const hasE = dir.includes('e');
      const hasW = dir.includes('w');
      const hasN = dir.includes('n');
      const hasS = dir.includes('s');
      const k = e.altKey ? 2 : 1;
      let w = r0.w + (hasE ? dx * k : hasW ? -dx * k : 0);
      let h = r0.h + (hasS ? dy * k : hasN ? -dy * k : 0);
      const moving = { w: hasE || hasW, h: hasN || hasS };
      let nominal: Size = { w: w - 2 * inset, h: h - 2 * inset };
      if (e.shiftKey) {
        const aspect = g.nominal0.w / g.nominal0.h;
        if (moving.w && (!moving.h || Math.abs(nominal.w / g.nominal0.w - 1) >= Math.abs(nominal.h / g.nominal0.h - 1))) nominal.h = nominal.w / aspect;
        else nominal.w = nominal.h * aspect;
        moving.w = moving.h = true;
      }
      let preset: SizePreset | null = null;
      let guides: Guide[] = [];
      const units = getDoc().prefs.units;
      if (!noSnap) {
        if (g.isFrame && !e.shiftKey) {
          const snapped = snapNominal(nominal, g.presets, screenPxToInches(12), stepFor(units), moving);
          nominal = snapped.size;
          preset = snapped.preset;
        } else if (!e.shiftKey) {
          nominal = {
            w: moving.w ? Math.round(nominal.w / stepFor(units)) * stepFor(units) : nominal.w,
            h: moving.h ? Math.round(nominal.h / stepFor(units)) * stepFor(units) : nominal.h,
          };
        }
      }
      const min = g.isFrame ? 2 : 1;
      nominal = { w: Math.max(min, nominal.w), h: Math.max(min, nominal.h) };
      w = nominal.w + 2 * inset;
      h = nominal.h + 2 * inset;
      const place = (ww: number, hh: number): Rect => ({
        x: e.altKey ? r0.x + r0.w / 2 - ww / 2 : hasW ? r0.x + r0.w - ww : r0.x,
        y: e.altKey ? r0.y + r0.h / 2 - hh / 2 : hasN ? r0.y + r0.h - hh : r0.y,
        w: ww,
        h: hh,
      });
      let rect = place(w, h);
      // Edge alignment when no preset captured the size.
      if (!noSnap && !preset && !e.shiftKey && !e.altKey) {
        const targets = snapTargets(new Set([g.id]));
        const thr = screenPxToInches(7);
        if (hasE || hasW) {
          const edge = hasE ? rect.x + rect.w : rect.x;
          const s = snapEdge(edge, 'x', rect, targets, thr);
          if (s.guides.length) {
            w = hasE ? s.value - rect.x : rect.x + rect.w - s.value;
            guides.push(...s.guides);
          }
        }
        if (hasN || hasS) {
          const edge = hasS ? rect.y + rect.h : rect.y;
          const s = snapEdge(edge, 'y', rect, targets, thr);
          if (s.guides.length) {
            h = hasS ? s.value - rect.y : rect.y + rect.h - s.value;
            guides.push(...s.guides);
          }
        }
        nominal = { w: Math.max(min, w - 2 * inset), h: Math.max(min, h - 2 * inset) };
        rect = place(nominal.w + 2 * inset, nominal.h + 2 * inset);
      }
      const hd = registry.get(g.id);
      if (hd) {
        hd.x.set(rect.x * PPI);
        hd.y.set(rect.y * PPI);
        hd.w.set(rect.w * PPI);
        hd.h.set(rect.h * PPI);
        if (preset && preset.id !== g.lastPreset) {
          animate(hd.pulse, [1, 1.022, 1], { duration: 0.32, ease: 'easeOut' });
          ui().set({ snapPulse: ui().snapPulse + 1 });
        }
      }
      g.lastPreset = preset?.id ?? null;
      g.result = { rect, nominal };
      const label = formatSize(nominal.w, nominal.h, units, false);
      ui().set({
        guides,
        chips: [],
        badge: {
          x: rect.x + rect.w / 2,
          y: rect.y,
          label: preset ? preset.label.replace(' cm', '') : label,
          sub: g.isFrame && inset > 0 ? `outer ${formatSize(rect.w, rect.h, units)}` : units === 'cm' ? 'cm' : 'inches',
          preset: !!preset,
        },
      });
      return;
    }

    if (g.kind === 'marquee') {
      const r: Rect = {
        x: Math.min(g.startWorld.x, world.x),
        y: Math.min(g.startWorld.y, world.y),
        w: Math.abs(world.x - g.startWorld.x),
        h: Math.abs(world.y - g.startWorld.y),
      };
      if (!g.moved && r.w < screenPxToInches(3) && r.h < screenPxToInches(3)) return;
      g.moved = true;
      const doc = getDoc();
      const hit = doc.order.filter((id) => rectsIntersect(r, itemRect(doc.items[id])));
      ui().set({ marquee: r, selection: [...new Set([...g.base, ...hit])] });
    }
  };

  const endGesture = (e: React.PointerEvent<HTMLDivElement>, cancelled = false) => {
    pointers.current.delete(e.pointerId);
    const g = gesture.current;
    if (g.kind === 'pinch') {
      if (pointers.current.size < 2) gesture.current = { kind: 'none' };
      return;
    }
    if ('pointerId' in g && g.pointerId !== e.pointerId) return;
    gesture.current = { kind: 'none' };
    ref.current!.classList.remove('is-dragging');

    if (g.kind === 'pan') {
      ui().set({ panning: false });
      const s = g.samples;
      if (!cancelled && s.length >= 2) {
        const a = s[0];
        const b = s[s.length - 1];
        const dt = (b.t - a.t) / 1000;
        if (dt > 0 && performance.now() - b.t < 60) fling((b.x - a.x) / dt, (b.y - a.y) / dt);
      }
      return;
    }
    if (g.kind === 'press') {
      // Plain click on an already-selected item inside a multi-selection: select just it.
      if (!e.shiftKey && g.wasSelected && ui().selection.length > 1) ui().select([g.clickedId]);
      return;
    }
    if (g.kind === 'move') {
      clearOverlays();
      if (cancelled) return revertLive(g.ids);
      const finals = g.ids.map((id) => [id, liveRect(id)] as const);
      commit((d) => {
        for (const [id, r] of finals) {
          if (!r || !d.items[id]) continue;
          d.items[id].x = r.x;
          d.items[id].y = r.y;
        }
      });
      for (const id of g.ids) {
        const h = registry.get(id);
        if (h) h.live.current = false;
      }
      return;
    }
    if (g.kind === 'resize') {
      clearOverlays();
      const h = registry.get(g.id);
      if (cancelled || !g.result) return revertLive([g.id]);
      const { rect, nominal } = g.result;
      commit((d) => {
        const it = d.items[g.id];
        if (!it) return;
        it.x = rect.x;
        it.y = rect.y;
        if (it.kind === 'frame') {
          it.nominal = nominal;
          const minSide = Math.min(nominal.w, nominal.h);
          if (it.mat.mode === 'uniform') it.mat.width = Math.min(it.mat.width, Math.max(0.25, minSide / 2 - 0.75));
        } else {
          it.w = rect.w;
          it.h = rect.h;
        }
      });
      if (h) h.live.current = false;
      return;
    }
    if (g.kind === 'marquee') {
      clearOverlays();
      if (!g.moved && !e.shiftKey) ui().select([]);
    }
  };

  // ---------- double click, drop, context ----------

  const onDoubleClick = (e: React.MouseEvent) => {
    // Pointer capture retargets click events to the viewport, so hit-test the actual point.
    const target = (document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null) ?? (e.target as HTMLElement);
    if (!ref.current!.contains(target)) return;
    const itemEl = target.closest<HTMLElement>('[data-item-id]');
    if (itemEl) {
      const id = itemEl.dataset.itemId!;
      const it = getDoc().items[id];
      if (it?.kind !== 'frame') return;
      const cellId = target.closest<HTMLElement>('[data-cell-id]')?.dataset.cellId ?? null;
      const cid = cellId === 'single' ? null : cellId;
      if (getPhoto(it, cid)) ui().set({ crop: { itemId: id, cellId: cid } });
      else openFilePicker((files) => fillFrame(id, cid, files), it.content.kind === 'grid');
      return;
    }
    if (target.closest('[data-handle]')) return;
    addFrame(clientToWorld(e.clientX, e.clientY), DEFAULT_NEW[getDoc().prefs.units]);
  };

  const dropTarget = useRef<HTMLElement | null>(null);
  const setDropTarget = (el: HTMLElement | null) => {
    if (dropTarget.current === el) return;
    dropTarget.current?.classList.remove('is-drop-target');
    el?.classList.add('is-drop-target');
    dropTarget.current = el;
  };

  const onDragOver = (e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
    const frameEl = el?.closest<HTMLElement>('[data-item-id]');
    const it = frameEl ? getDoc().items[frameEl.dataset.itemId!] : null;
    setDropTarget(it?.kind === 'frame' ? (el?.closest<HTMLElement>('[data-cell-id]') ?? frameEl!) : null);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDropTarget(null);
    const files = [...e.dataTransfer.files];
    if (!files.length) return;
    const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
    const frameEl = el?.closest<HTMLElement>('[data-item-id]');
    const it = frameEl ? getDoc().items[frameEl.dataset.itemId!] : null;
    if (it?.kind === 'frame') {
      const cellId = el?.closest<HTMLElement>('[data-cell-id]')?.dataset.cellId ?? null;
      void fillFrame(it.id, cellId === 'single' ? null : cellId, files);
      ui().select([it.id]);
    } else {
      void framesFromPhotos(files, clientToWorld(e.clientX, e.clientY));
    }
  };

  const onContextMenu = (e: React.MouseEvent) => {
    const itemEl = (e.target as HTMLElement).closest<HTMLElement>('[data-item-id]');
    if (itemEl) {
      const id = itemEl.dataset.itemId!;
      if (!ui().selection.includes(id)) ui().select([id]);
    } else ui().select([]);
  };

  const frames = order.filter((id) => items[id]?.kind === 'frame');
  const furniture = order.filter((id) => items[id]?.kind === 'furniture');
  const cursor = panning ? 'grabbing' : spaceDown || tool === 'hand' ? 'grab' : 'default';

  return (
    <div
      ref={ref}
      className="gw-viewport"
      style={{ cursor }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={(e) => endGesture(e)}
      onPointerCancel={(e) => endGesture(e, true)}
      onLostPointerCapture={(e) => {
        if (pointers.current.has(e.pointerId)) endGesture(e);
      }}
      onDoubleClick={onDoubleClick}
      onDragOver={onDragOver}
      onDragLeave={(e) => {
        if (e.target === ref.current) setDropTarget(null);
      }}
      onDrop={onDrop}
      onContextMenu={onContextMenu}
    >
      <motion.div className="gw-camera" style={{ transform }}>
        {/* World box includes the 14″ floor strip so exports capture it. */}
        <div className="gw-world" data-world style={{ width: wall.width * PPI, height: (wall.height + 14) * PPI }}>
          <WallSurface wall={wall} />
          {frames.map((id) => (
            <ItemNode key={id} id={id} />
          ))}
          {furniture.map((id) => (
            <ItemNode key={id} id={id} />
          ))}
        </div>
        <GuidesLayer />
      </motion.div>
    </div>
  );
}

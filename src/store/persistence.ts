import { create } from 'zustand';
import { db } from './db';
import { useDoc, getDoc } from './docStore';
import { ui } from './uiStore';
import { newFrame, newFurniture, newWallDoc, newId, gridContent } from '../model/defaults';
import type { FrameItem, WallDoc } from '../model/types';
import { frameMetrics } from '../geometry/frameGeometry';
import { arrange } from '../geometry/arrange';
import { defaultPlacement } from '../geometry/crop';
import { ingest } from '../photos/assets';
import { renderSample, SAMPLE_ART } from '../photos/sampleArt';
import { fitRect, viewportEl } from './camera';

const LAST_KEY = 'gw:lastWall';

export const useSaveState = create<{ status: 'idle' | 'saving' | 'saved' | 'error' }>(() => ({ status: 'idle' }));

const remember = (id: string) => {
  try {
    localStorage.setItem(LAST_KEY, id);
  } catch {
    /* storage unavailable */
  }
};

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let lastSaved: WallDoc | null = null;

async function saveNow() {
  const doc = getDoc();
  if (doc === lastSaved) return;
  useSaveState.setState({ status: 'saving' });
  try {
    await db.walls.put(doc);
    lastSaved = doc;
    useSaveState.setState({ status: 'saved' });
  } catch (err) {
    console.error(err);
    useSaveState.setState({ status: 'error' });
  }
}

export function startAutosave() {
  useDoc.subscribe((s, prev) => {
    if (s.doc === prev.doc) return;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, 500);
  });
  window.addEventListener('beforeunload', () => {
    if (saveTimer) void saveNow();
  });
}

function fitWall(doc: WallDoc, animated: boolean) {
  if (!viewportEl.current) return; // the viewport fits itself when it mounts
  fitRect({ x: -4, y: -4, w: doc.wall.width + 8, h: doc.wall.height + 18 }, { padding: 90, animated });
}

export function loadWall(doc: WallDoc, animated = true) {
  lastSaved = doc;
  useDoc.getState().load(doc);
  ui().set({ selection: [], crop: null, hangStep: null });
  remember(doc.id);
  fitWall(doc, animated);
}

export async function openWall(id: string) {
  if (saveTimer) await saveNow();
  const doc = await db.walls.get(id);
  if (doc) loadWall(doc);
}

export async function createWall(name = 'Untitled wall') {
  if (saveTimer) await saveNow();
  const doc = newWallDoc(name);
  doc.items = {};
  await db.walls.put(doc);
  loadWall(doc);
}

export async function duplicateWall(id: string) {
  const src = await db.walls.get(id);
  if (!src) return;
  const copy: WallDoc = { ...structuredClone(src), id: newId(), name: `${src.name} (copy)`, createdAt: Date.now(), updatedAt: Date.now() };
  await db.walls.put(copy);
  return copy;
}

export async function deleteWall(id: string) {
  await db.walls.delete(id);
  if (getDoc().id === id) {
    const next = await db.walls.orderBy('updatedAt').last();
    if (next) loadWall(next);
    else await createWall();
  }
}

export async function renameWall(id: string, name: string) {
  if (getDoc().id === id) {
    useDoc.getState().commit((d) => {
      d.name = name;
    });
    return;
  }
  await db.walls.update(id, { name });
}

/** A starter salon wall above a sofa, painted with procedural sample art. */
export async function buildDemoWall(): Promise<WallDoc> {
  const doc = newWallDoc('Living room salon wall');
  const assets = await Promise.all(SAMPLE_ART.map((_, i) => renderSample(i).then((f) => ingest(f))));
  const [dusk, bauhaus, tidal, fern, ember, phases, horizon, arches] = assets.map((a) => a.id);

  const specs: Array<{ w: number; h: number; style: string; photo?: string; mat?: boolean; grid?: [number, number, string[]]; name: string }> = [
    { w: 16, h: 20, style: 'gold-ornate', photo: dusk, mat: true, name: 'Dusk Ridge' },
    { w: 11, h: 14, style: 'oak', photo: fern, mat: true, name: 'Fern Study' },
    { w: 18, h: 12, style: 'metal-print', photo: horizon, name: 'Horizon' },
    { w: 8, h: 10, style: 'thin-black', photo: bauhaus, mat: true, name: 'Bauhaus No. 3' },
    { w: 12, h: 12, style: 'thin-white', photo: arches, mat: true, name: 'Arches' },
    { w: 16, h: 20, style: 'canvas', photo: ember, name: 'Ember Field' },
    { w: 20, h: 10, style: 'gallery-black', photo: phases, mat: true, name: 'Phases' },
    { w: 14, h: 14, style: 'walnut', grid: [2, 2, [tidal, fern, arches, bauhaus]], mat: true, name: 'Collage' },
    { w: 7, h: 5, style: 'brass', photo: tidal, mat: true, name: 'Tidal' },
  ];

  const frames: FrameItem[] = specs.map((s) => {
    const f = newFrame({ x: 0, y: 0, nominal: { w: s.w, h: s.h }, styleId: s.style, name: s.name });
    if (s.mat === false) f.mat.enabled = false;
    if (s.grid) {
      const g = gridContent(s.grid[0], s.grid[1], 0.5);
      g.cells.forEach((c, i) => (c.photo = defaultPlacement(s.grid![2][i])));
      f.content = g;
      f.mat.width = 1.75;
    } else if (s.photo) f.content = { kind: 'single', photo: defaultPlacement(s.photo) };
    return f;
  });

  const sofa = newFurniture('sofa', doc.wall.height, doc.wall.width / 2 - 42);
  const lamp = newFurniture('plant', doc.wall.height, doc.wall.width / 2 + 48);
  const pos = arrange(
    frames.map((f) => ({ id: f.id, ...frameMetrics(f).outer })),
    { mode: 'salon', gap: 2.5, seed: 7, center: { x: doc.wall.width / 2, y: doc.wall.height - doc.wall.eyeLine }, targetAspect: 1.9, maxBottom: sofa.y - 8, minTop: 6 },
  );
  for (const f of frames) {
    f.x = pos[f.id].x;
    f.y = pos[f.id].y;
    doc.items[f.id] = f;
    doc.order.push(f.id);
  }
  doc.items[sofa.id] = sofa;
  doc.items[lamp.id] = lamp;
  doc.order.unshift(sofa.id, lamp.id);
  return doc;
}

let booting: Promise<void> | null = null;
export const boot = () => (booting ??= bootOnce());

async function bootOnce() {
  try {
    await navigator.storage?.persist?.();
  } catch {
    /* not supported */
  }
  let id: string | null = null;
  try {
    id = localStorage.getItem(LAST_KEY);
  } catch {
    /* storage unavailable */
  }
  let doc = id ? await db.walls.get(id) : undefined;
  if (!doc) doc = await db.walls.orderBy('updatedAt').last();
  if (!doc) {
    doc = await buildDemoWall();
    await db.walls.put(doc);
  }
  loadWall(doc, false);
  startAutosave();
}

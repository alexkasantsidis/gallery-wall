import { create } from 'zustand';
import { produce, freeze } from 'immer';
import type { WallDoc } from '../model/types';
import { newWallDoc } from '../model/defaults';

const HISTORY_LIMIT = 200;
const COALESCE_MS = 1200;

interface DocState {
  doc: WallDoc;
  past: WallDoc[];
  future: WallDoc[];
  last: { key: string | null; t: number };
  /** Apply a change as one undoable step. Changes sharing a `key` within ~1s merge into one step (sliders, typing, nudges). */
  commit: (recipe: (d: WallDoc) => void, opts?: { key?: string }) => void;
  undo: () => void;
  redo: () => void;
  load: (doc: WallDoc) => void;
}

export const useDoc = create<DocState>((set, get) => ({
  doc: freeze(newWallDoc(), true),
  past: [],
  future: [],
  last: { key: null, t: 0 },
  commit: (recipe, opts) => {
    const { doc, past, last } = get();
    const next = produce(doc, (d) => {
      recipe(d);
      d.updatedAt = Date.now();
    });
    if (next === doc) return;
    const now = performance.now();
    const coalesce = !!opts?.key && opts.key === last.key && now - last.t < COALESCE_MS;
    set({
      doc: next,
      past: coalesce ? past : [...past.slice(-HISTORY_LIMIT + 1), doc],
      future: [],
      last: { key: opts?.key ?? null, t: now },
    });
  },
  undo: () => {
    const { past, doc, future } = get();
    if (!past.length) return;
    set({ doc: past[past.length - 1], past: past.slice(0, -1), future: [doc, ...future], last: { key: null, t: 0 } });
  },
  redo: () => {
    const { past, doc, future } = get();
    if (!future.length) return;
    set({ doc: future[0], past: [...past, doc], future: future.slice(1), last: { key: null, t: 0 } });
  },
  load: (doc) => set({ doc: freeze(doc, true), past: [], future: [], last: { key: null, t: 0 } }),
}));

export const getDoc = () => useDoc.getState().doc;
export const commit = (recipe: (d: WallDoc) => void, opts?: { key?: string }) => useDoc.getState().commit(recipe, opts);

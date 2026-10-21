import { create } from 'zustand';
import type { GapChip, Guide } from '../geometry/snapping';
import type { Rect } from '../model/types';

export type Modal = null | 'walls' | 'shopping' | 'shortcuts' | 'hang' | 'export';

export interface SizeBadge {
  /** World inches: where to draw the badge (top centre of the frame). */
  x: number;
  y: number;
  label: string;
  sub: string;
  preset: boolean;
}

export interface CropTarget {
  itemId: string;
  cellId: string | null;
}

interface UiState {
  selection: string[];
  tool: 'select' | 'hand';
  spaceDown: boolean;
  panning: boolean;
  modal: Modal;
  crop: CropTarget | null;
  calibrating: boolean;
  hangStep: number | null;
  /** Item ids that are currently ingesting a photo. */
  loading: Record<string, true>;
  /** Interaction overlays (world inches). */
  guides: Guide[];
  chips: GapChip[];
  badge: SizeBadge | null;
  marquee: Rect | null;
  /** Monotonic counter used to re-trigger a snap "thunk". */
  snapPulse: number;
  toast: { id: number; text: string } | null;
  leftPanel: 'frames' | 'furniture' | 'wall' | null;
  showInspector: boolean;
  set: (p: Partial<UiState>) => void;
  select: (ids: string[]) => void;
  toggle: (id: string) => void;
}

export const useUi = create<UiState>((set) => ({
  selection: [],
  tool: 'select',
  spaceDown: false,
  panning: false,
  modal: null,
  crop: null,
  calibrating: false,
  hangStep: null,
  loading: {},
  guides: [],
  chips: [],
  badge: null,
  marquee: null,
  snapPulse: 0,
  toast: null,
  leftPanel: 'frames',
  showInspector: true,
  set: (p) => set(p),
  select: (ids) => set({ selection: ids }),
  toggle: (id) => set((s) => ({ selection: s.selection.includes(id) ? s.selection.filter((x) => x !== id) : [...s.selection, id] })),
}));

export const ui = () => useUi.getState();

let toastId = 0;
export function toast(text: string) {
  const id = ++toastId;
  useUi.getState().set({ toast: { id, text } });
  setTimeout(() => {
    if (useUi.getState().toast?.id === id) useUi.getState().set({ toast: null });
  }, 2600);
}

export const clearOverlays = () => useUi.getState().set({ guides: [], chips: [], badge: null, marquee: null });

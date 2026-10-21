import { useEffect } from 'react';
import { useDoc, getDoc } from '../store/docStore';
import { ui } from '../store/uiStore';
import {
  addFrame,
  copySelection,
  deleteSelection,
  duplicate,
  fillFrame,
  framesFromPhotos,
  nudge,
  pasteClipboard,
  reorder,
  rotateSelection,
  selectAll,
  selectedItems,
} from '../store/actions';
import { fitRect, screenToWorld, viewportSize, zoomBy } from '../store/camera';
import { itemRect, unionRect } from '../geometry/frameGeometry';
import { fitWall } from '../panels/Navigator';

const isTyping = (e: Event) => {
  const t = e.target as HTMLElement | null;
  return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
};

const viewCenter = () => {
  const { w, h } = viewportSize();
  return screenToWorld(w / 2, h / 2);
};

export function useShortcuts() {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTyping(e) || ui().crop || ui().modal) return;
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      if (e.code === 'Space') {
        if (!ui().spaceDown) ui().set({ spaceDown: true });
        e.preventDefault();
        return;
      }
      if (mod && k === 'z') {
        e.preventDefault();
        if (e.shiftKey) useDoc.getState().redo();
        else useDoc.getState().undo();
        return;
      }
      if (mod && k === 'y') {
        e.preventDefault();
        useDoc.getState().redo();
        return;
      }
      if (mod && k === 'd') {
        e.preventDefault();
        duplicate();
        return;
      }
      if (mod && k === 'a') {
        e.preventDefault();
        selectAll();
        return;
      }
      if (mod && k === 'c') {
        copySelection();
        return;
      }
      if (mod && (k === '=' || k === '+')) {
        e.preventDefault();
        zoomBy(1.25);
        return;
      }
      if (mod && k === '-') {
        e.preventDefault();
        zoomBy(1 / 1.25);
        return;
      }
      if (mod) return;
      if (k === 'delete' || k === 'backspace') {
        e.preventDefault();
        deleteSelection();
      } else if (k === 'escape') {
        ui().set({ selection: [], hangStep: null, tool: 'select' });
      } else if (k.startsWith('arrow')) {
        e.preventDefault();
        const step = e.shiftKey ? 1 : 0.125;
        const dx = k === 'arrowleft' ? -step : k === 'arrowright' ? step : 0;
        const dy = k === 'arrowup' ? -step : k === 'arrowdown' ? step : 0;
        if (ui().selection.length) nudge(dx, dy);
      } else if (k === 'f') {
        const d = getDoc();
        addFrame(viewCenter(), d.prefs.units === 'cm' ? { w: 20 / 2.54, h: 25 / 2.54 } : { w: 8, h: 10 });
      } else if (k === 'r') {
        rotateSelection();
      } else if (k === ']') {
        reorder(e.shiftKey ? 'front' : 'forward');
      } else if (k === '[') {
        reorder(e.shiftKey ? 'back' : 'backward');
      } else if (k === 'v') {
        ui().set({ tool: 'select' });
      } else if (k === 'h') {
        ui().set({ tool: 'hand' });
      } else if (e.key === '!' || (e.shiftKey && e.code === 'Digit1')) {
        fitWall();
      } else if (e.key === '@' || (e.shiftKey && e.code === 'Digit2')) {
        const r = unionRect(selectedItems().map(itemRect));
        if (r) fitRect(r, { animated: true, padding: 140 });
      } else if (e.key === '?') {
        ui().set({ modal: 'shortcuts' });
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') ui().set({ spaceDown: false });
    };
    const onBlur = () => ui().set({ spaceDown: false });
    const onPaste = (e: ClipboardEvent) => {
      if (isTyping(e) || ui().crop) return;
      const files = [...(e.clipboardData?.files ?? [])].filter((f) => f.type.startsWith('image/'));
      if (files.length) {
        e.preventDefault();
        const sel = selectedItems();
        if (sel.length === 1 && sel[0].kind === 'frame') void fillFrame(sel[0].id, null, files);
        else void framesFromPhotos(files, viewCenter());
        return;
      }
      pasteClipboard();
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    window.addEventListener('paste', onPaste);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('paste', onPaste);
    };
  }, []);
}

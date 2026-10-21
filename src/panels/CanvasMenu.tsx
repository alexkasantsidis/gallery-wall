import type { ReactNode } from 'react';
import * as CM from '@radix-ui/react-context-menu';
import { Copy, Trash2, Lock, ArrowUpToLine, ArrowDownToLine, RotateCw, Crop, ImagePlus, Grid2x2, Square, Plus, ClipboardPaste, Shuffle } from 'lucide-react';
import { useUi, ui } from '../store/uiStore';
import { useDoc, getDoc } from '../store/docStore';
import { addFrame, deleteSelection, duplicate, reorder, rotateSelection, toggleLock, setGrid, fillFrame, getPhoto, pasteClipboard, arrangeSelection } from '../store/actions';
import { clientToWorld } from '../store/camera';
import { openFilePicker } from '../photos/filePicker';

const itemCls = 'flex cursor-default items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[12.5px] text-ink-200 outline-none data-[highlighted]:bg-white/9 data-[highlighted]:text-white';

function Item({ icon, children, onSelect, kbd }: { icon: ReactNode; children: ReactNode; onSelect: () => void; kbd?: string }) {
  return (
    <CM.Item className={itemCls} onSelect={onSelect}>
      <span className="text-ink-400">{icon}</span>
      {children}
      {kbd && <span className="ml-auto pl-4 text-[11px] text-ink-500">{kbd}</span>}
    </CM.Item>
  );
}

let lastPoint = { x: 0, y: 0 };

export function CanvasMenu({ children }: { children: ReactNode }) {
  const selection = useUi((s) => s.selection);
  const items = useDoc((s) => s.doc.items);
  const sel = selection.map((id) => items[id]).filter(Boolean);
  const one = sel.length === 1 ? sel[0] : null;
  const frame = one?.kind === 'frame' ? one : null;
  return (
    <CM.Root>
      <CM.Trigger asChild onContextMenu={(e) => (lastPoint = clientToWorld(e.clientX, e.clientY))}>
        {children}
      </CM.Trigger>
      <CM.Portal>
        <CM.Content className="glass z-50 min-w-52 rounded-xl p-1.5">
          {sel.length === 0 ? (
            <>
              <Item icon={<Plus size={14} />} onSelect={() => addFrame(lastPoint, getDoc().prefs.units === 'cm' ? { w: 20 / 2.54, h: 25 / 2.54 } : { w: 8, h: 10 })} kbd="F">
                New frame here
              </Item>
              <Item icon={<ClipboardPaste size={14} />} onSelect={() => pasteClipboard()} kbd="Ctrl V">
                Paste
              </Item>
              <Item icon={<Shuffle size={14} />} onSelect={() => arrangeSelection('salon')}>
                Shuffle all frames
              </Item>
            </>
          ) : (
            <>
              {frame && (
                <>
                  {getPhoto(frame, null) && frame.content.kind === 'single' && (
                    <Item icon={<Crop size={14} />} onSelect={() => ui().set({ crop: { itemId: frame.id, cellId: null } })}>
                      Crop & adjust photo
                    </Item>
                  )}
                  <Item icon={<ImagePlus size={14} />} onSelect={() => openFilePicker((f) => fillFrame(frame.id, null, f), frame.content.kind === 'grid')}>
                    {frame.content.kind === 'grid' ? 'Add photos to grid' : getPhoto(frame, null) ? 'Replace photo' : 'Add photo'}
                  </Item>
                  {frame.content.kind === 'single' ? (
                    <Item icon={<Grid2x2 size={14} />} onSelect={() => setGrid(frame.id, 2, 2)}>
                      Make a 2×2 picture grid
                    </Item>
                  ) : (
                    <Item icon={<Square size={14} />} onSelect={() => setGrid(frame.id, 1, 1)}>
                      Back to single photo
                    </Item>
                  )}
                  <Item icon={<RotateCw size={14} />} onSelect={rotateSelection} kbd="R">
                    Rotate 90°
                  </Item>
                  <CM.Separator className="my-1 h-px bg-white/8" />
                </>
              )}
              <Item icon={<Copy size={14} />} onSelect={() => duplicate()} kbd="Ctrl D">
                Duplicate
              </Item>
              <Item icon={<ArrowUpToLine size={14} />} onSelect={() => reorder('front')} kbd="]">
                Bring to front
              </Item>
              <Item icon={<ArrowDownToLine size={14} />} onSelect={() => reorder('back')} kbd="[">
                Send to back
              </Item>
              <Item icon={<Lock size={14} />} onSelect={toggleLock}>
                {sel.every((i) => i.locked) ? 'Unlock' : 'Lock'}
              </Item>
              <CM.Separator className="my-1 h-px bg-white/8" />
              <CM.Item className={`${itemCls} data-[highlighted]:bg-red-500/20 data-[highlighted]:text-red-200`} onSelect={deleteSelection}>
                <Trash2 size={14} className="text-red-300" /> Delete
                <span className="ml-auto pl-4 text-[11px] text-ink-500">Del</span>
              </CM.Item>
            </>
          )}
        </CM.Content>
      </CM.Portal>
    </CM.Root>
  );
}

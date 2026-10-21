import { useEffect, useState, type ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { AnimatePresence, motion } from 'motion/react';
import { Plus, Copy, Trash2, X, ClipboardCopy, Sparkles } from 'lucide-react';
import { useUi, ui, toast } from '../store/uiStore';
import { useDoc } from '../store/docStore';
import { db } from '../store/db';
import type { WallDoc } from '../model/types';
import { createWall, deleteWall, duplicateWall, openWall, buildDemoWall, loadWall, useSaveState } from '../store/persistence';
import { itemRect } from '../geometry/frameGeometry';
import { styleById } from '../model/frameStyles';
import { shoppingList, shoppingText } from '../export/shoppingList';
import { Button } from '../components/ui';

function Modal({ open, title, children, width = 640 }: { open: boolean; title: string; children: ReactNode; width?: number }) {
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && ui().set({ modal: null })}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div className="fixed inset-0 z-40 bg-black/55 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
            </Dialog.Overlay>
            <Dialog.Content asChild forceMount onKeyDown={(e) => e.stopPropagation()}>
              <motion.div
                className="glass fixed top-1/2 left-1/2 z-50 flex max-h-[82vh] flex-col overflow-hidden rounded-2xl"
                style={{ width: `min(${width}px, calc(100vw - 32px))`, x: '-50%', y: '-50%' }}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              >
                <div className="flex items-center justify-between border-b border-white/6 px-5 py-3.5">
                  <Dialog.Title className="text-[14px] font-semibold text-white">{title}</Dialog.Title>
                  <Dialog.Close className="grid h-7 w-7 place-items-center rounded-lg text-ink-400 hover:bg-white/8 hover:text-white">
                    <X size={15} />
                  </Dialog.Close>
                </div>
                <div className="scroll-thin overflow-y-auto">{children}</div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}

/** Schematic thumbnail drawn from the wall data. */
function WallThumb({ doc }: { doc: WallDoc }) {
  const W = 180;
  const s = W / doc.wall.width;
  return (
    <div className="relative overflow-hidden rounded-lg" style={{ width: W, height: doc.wall.height * s, background: doc.wall.style.color }}>
      {doc.order.map((id) => {
        const it = doc.items[id];
        if (!it) return null;
        const r = itemRect(it);
        const c = it.kind === 'frame' ? (it.color ?? styleById(it.styleId).color) : it.color;
        return <div key={id} className="absolute rounded-[1px] shadow-sm" style={{ left: r.x * s, top: r.y * s, width: r.w * s, height: r.h * s, background: c, opacity: it.kind === 'furniture' ? 0.55 : 1 }} />;
      })}
    </div>
  );
}

function WallsGallery() {
  const currentId = useDoc((s) => s.doc.id);
  const status = useSaveState((s) => s.status);
  const [walls, setWalls] = useState<WallDoc[] | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const refresh = () => db.walls.orderBy('updatedAt').reverse().toArray().then(setWalls);
  useEffect(() => {
    void refresh();
  }, [status]);
  const close = () => ui().set({ modal: null });
  return (
    <div className="p-4">
      <div className="mb-3 flex gap-2">
        <Button variant="primary" onClick={() => createWall().then(close)}>
          <Plus size={14} /> New blank wall
        </Button>
        <Button
          variant="soft"
          onClick={async () => {
            const d = await buildDemoWall();
            await db.walls.put(d);
            loadWall(d);
            close();
          }}
        >
          <Sparkles size={14} /> New sample wall
        </Button>
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
        {walls?.map((w) => (
          <div key={w.id} className={`group rounded-xl p-2.5 transition-colors ${w.id === currentId ? 'bg-accent/15 ring-1 ring-accent/50' : 'bg-white/4 hover:bg-white/8'}`}>
            <button className="block w-full text-left" onClick={() => openWall(w.id).then(close)}>
              <WallThumb doc={w} />
              <div className="mt-2 truncate text-[12.5px] font-medium text-white">{w.name}</div>
              <div className="text-[11px] text-ink-400">
                {Object.values(w.items).filter((i) => i.kind === 'frame').length} frames · {new Date(w.updatedAt).toLocaleDateString()}
              </div>
            </button>
            <div className="mt-1.5 flex gap-1 opacity-70 group-hover:opacity-100">
              <Button variant="ghost" className="h-7 px-2" onClick={() => duplicateWall(w.id).then(refresh)}>
                <Copy size={13} /> Duplicate
              </Button>
              {confirm === w.id ? (
                <Button variant="danger" className="h-7 px-2" onClick={() => deleteWall(w.id).then(() => (setConfirm(null), refresh()))}>
                  Confirm delete
                </Button>
              ) : (
                <Button variant="ghost" className="h-7 px-2 hover:text-red-300" onClick={() => setConfirm(w.id)}>
                  <Trash2 size={13} />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Shopping() {
  const doc = useDoc((s) => s.doc);
  const groups = shoppingList(doc);
  return (
    <div className="p-5">
      {groups.map((g) => (
        <div key={g.title} className="mb-4">
          <h3 className="mb-1.5 text-[10.5px] font-semibold tracking-[0.08em] text-ink-400 uppercase">{g.title}</h3>
          {g.lines.map((l, i) => (
            <div key={i} className="flex items-baseline gap-3 border-b border-white/5 py-1.5 text-[12.5px]">
              <span className="w-8 text-right font-semibold text-accent-soft tabular-nums">{l.qty}×</span>
              <span className="text-ink-200">{l.text}</span>
              {l.detail && <span className="ml-auto text-[11px] text-ink-500">{l.detail}</span>}
            </div>
          ))}
        </div>
      ))}
      <Button
        variant="soft"
        onClick={() =>
          navigator.clipboard.writeText(shoppingText(doc)).then(
            () => toast('Shopping list copied'),
            () => toast('Clipboard unavailable'),
          )
        }
      >
        <ClipboardCopy size={14} /> Copy as text
      </Button>
    </div>
  );
}

const SHORTCUTS: [string, string][] = [
  ['Pan', 'Space + drag · middle mouse · two-finger scroll'],
  ['Zoom', 'Ctrl/⌘ + scroll · pinch · Ctrl + / −'],
  ['Fit wall / selection', 'Shift 1 / Shift 2'],
  ['New frame', 'Double-click wall · F · drag from palette'],
  ['Select / add to selection', 'Click / Shift-click · drag a box'],
  ['Move', 'Drag · arrows ⅛″ · Shift + arrows 1″'],
  ['Resize', 'Handles · Shift keeps aspect · Alt from centre'],
  ['Bypass snapping', 'Hold Ctrl/⌘ while dragging'],
  ['Duplicate', 'Alt-drag · Ctrl D'],
  ['Copy / paste', 'Ctrl C / Ctrl V (paste images to fill frames)'],
  ['Rotate portrait ↔ landscape', 'R'],
  ['Bring forward / back', '] / ['],
  ['Crop photo', 'Double-click a photo'],
  ['Delete', 'Delete / Backspace'],
  ['Undo / redo', 'Ctrl Z / Ctrl Shift Z'],
  ['Select / pan tool', 'V / H'],
];

function Shortcuts() {
  return (
    <div className="grid grid-cols-1 gap-x-6 p-5 sm:grid-cols-2">
      {SHORTCUTS.map(([a, b]) => (
        <div key={a} className="border-b border-white/5 py-2">
          <div className="text-[12.5px] text-white">{a}</div>
          <div className="text-[11.5px] text-ink-400">{b}</div>
        </div>
      ))}
    </div>
  );
}

export function Modals() {
  const modal = useUi((s) => s.modal);
  return (
    <>
      <Modal open={modal === 'walls'} title="Your walls" width={860}>
        <WallsGallery />
      </Modal>
      <Modal open={modal === 'shopping'} title="Shopping list">
        <Shopping />
      </Modal>
      <Modal open={modal === 'shortcuts'} title="Keyboard & gestures" width={720}>
        <Shortcuts />
      </Modal>
    </>
  );
}

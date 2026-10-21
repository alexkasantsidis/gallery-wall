import { useState } from 'react';
import clsx from 'clsx';
import {
  Undo2,
  Redo2,
  MousePointer2,
  Hand,
  Magnet,
  Shuffle,
  LayoutGrid,
  Rows3,
  Ruler,
  Download,
  Upload,
  ImageDown,
  FileText,
  Scissors,
  ShoppingBag,
  Keyboard,
  GalleryHorizontalEnd,
  ChevronDown,
  Check,
  Loader2,
  CloudOff,
} from 'lucide-react';
import { useDoc, commit, getDoc } from '../store/docStore';
import { useUi, ui, toast } from '../store/uiStore';
import { useSaveState, loadWall } from '../store/persistence';
import { arrangeSelection } from '../store/actions';
import { IconButton, Popover, Segmented, Tip } from '../components/ui';
import { openFilePicker } from '../photos/filePicker';

// Export code (pdf-lib, zip, screenshot) is loaded on demand to keep startup fast.
const exportPng = async (...a: Parameters<typeof import('../export/exportPng').exportPng>) => (await import('../export/exportPng')).exportPng(...a);
const exportWallFile = async (...a: Parameters<typeof import('../export/wallFile').exportWallFile>) => (await import('../export/wallFile')).exportWallFile(...a);
const importWallFile = async (...a: Parameters<typeof import('../export/wallFile').importWallFile>) => (await import('../export/wallFile')).importWallFile(...a);
const hangingGuidePdf = async (...a: Parameters<typeof import('../export/pdf').hangingGuidePdf>) => (await import('../export/pdf')).hangingGuidePdf(...a);
const paperTemplatesPdf = async (...a: Parameters<typeof import('../export/pdf').paperTemplatesPdf>) => (await import('../export/pdf')).paperTemplatesPdf(...a);

function Divider() {
  return <div className="mx-1 h-5 w-px bg-white/10" />;
}

function SaveIndicator() {
  const status = useSaveState((s) => s.status);
  if (status === 'error')
    return (
      <Tip label="Couldn't save to this browser">
        <span className="text-red-300">
          <CloudOff size={14} />
        </span>
      </Tip>
    );
  return (
    <span className="flex w-4 justify-center text-ink-500" title={status === 'saving' ? 'Saving…' : 'Saved in this browser'}>
      {status === 'saving' ? <Loader2 size={13} className="animate-spin" /> : status === 'saved' ? <Check size={13} /> : null}
    </span>
  );
}

const run = async (label: string, fn: () => Promise<unknown>) => {
  toast(`${label}…`);
  try {
    await fn();
  } catch (err) {
    console.error(err);
    toast(`${label} failed`);
  }
};

export function Toolbar() {
  const name = useDoc((s) => s.doc.name);
  const canUndo = useDoc((s) => s.past.length > 0);
  const canRedo = useDoc((s) => s.future.length > 0);
  const units = useDoc((s) => s.doc.prefs.units);
  const snap = useDoc((s) => s.doc.prefs.snap);
  const tool = useUi((s) => s.tool);
  const hang = useUi((s) => s.hangStep != null);
  const [seed, setSeed] = useState(1);

  return (
    <div className="pointer-events-none absolute top-3 right-0 left-0 flex justify-center px-4">
      <div className="glass pointer-events-auto flex items-center gap-0.5 rounded-2xl px-2 py-1.5">
        <IconButton label="Your walls" onClick={() => ui().set({ modal: 'walls' })}>
          <GalleryHorizontalEnd size={16} />
        </IconButton>
        <input
          value={name}
          onChange={(e) => commit((d) => void (d.name = e.target.value), { key: 'wall-name' })}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
          className="w-44 truncate rounded-md bg-transparent px-1.5 py-1 text-[13px] font-medium text-white outline-none hover:bg-white/5 focus:bg-white/8"
        />
        <SaveIndicator />
        <Divider />
        <IconButton label="Undo (Ctrl Z)" disabled={!canUndo} onClick={() => useDoc.getState().undo()}>
          <Undo2 size={16} />
        </IconButton>
        <IconButton label="Redo (Ctrl Shift Z)" disabled={!canRedo} onClick={() => useDoc.getState().redo()}>
          <Redo2 size={16} />
        </IconButton>
        <Divider />
        <IconButton label="Select (V)" active={tool === 'select'} onClick={() => ui().set({ tool: 'select' })}>
          <MousePointer2 size={16} />
        </IconButton>
        <IconButton label="Pan (H, or hold Space)" active={tool === 'hand'} onClick={() => ui().set({ tool: 'hand' })}>
          <Hand size={16} />
        </IconButton>
        <IconButton label={snap ? 'Snapping on (hold Ctrl to bypass)' : 'Snapping off'} active={snap} onClick={() => commit((d) => void (d.prefs.snap = !d.prefs.snap))}>
          <Magnet size={16} />
        </IconButton>
        <Divider />
        <Popover.Root>
          <Tip label="Auto-arrange">
            <Popover.Trigger asChild>
              <button className="flex h-8 items-center gap-1 rounded-lg px-2 text-[12px] font-medium text-ink-200 hover:bg-white/8 hover:text-white">
                <Shuffle size={15} /> Arrange <ChevronDown size={12} className="text-ink-500" />
              </button>
            </Popover.Trigger>
          </Tip>
          <Popover.Portal>
            <Popover.Content sideOffset={10} className="glass z-50 w-64 rounded-2xl p-1.5">
              {[
                { mode: 'salon' as const, icon: Shuffle, title: 'Salon shuffle', sub: 'Balanced chaos around eye level' },
                { mode: 'grid' as const, icon: LayoutGrid, title: 'Grid', sub: 'Rows on shared centre lines' },
                { mode: 'row' as const, icon: Rows3, title: 'Single row', sub: 'One line on the eye level' },
              ].map((m) => (
                <button
                  key={m.mode}
                  onClick={() => {
                    setSeed(seed + 1);
                    arrangeSelection(m.mode, m.mode === 'salon' ? seed * 7919 + Date.now() % 997 : seed);
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left hover:bg-white/8"
                >
                  <m.icon size={16} className="text-accent-soft" />
                  <div>
                    <div className="text-[12.5px] font-medium text-white">{m.title}</div>
                    <div className="text-[11px] text-ink-400">{m.sub}</div>
                  </div>
                </button>
              ))}
              <div className="px-2.5 pt-1 pb-1.5 text-[10.5px] text-ink-500">Uses the selected frames, or all frames when fewer than two are selected.</div>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
        <IconButton label="Hang mode: nail positions" active={hang} onClick={() => ui().set({ hangStep: hang ? null : 1, selection: [] })}>
          <Ruler size={16} />
        </IconButton>
        <IconButton label="Shopping list" onClick={() => ui().set({ modal: 'shopping' })}>
          <ShoppingBag size={16} />
        </IconButton>
        <Popover.Root>
          <Tip label="Export & import">
            <Popover.Trigger asChild>
              <button className="grid h-8 w-8 place-items-center rounded-lg text-ink-300 hover:bg-white/8 hover:text-white">
                <Download size={16} />
              </button>
            </Popover.Trigger>
          </Tip>
          <Popover.Portal>
            <Popover.Content sideOffset={10} align="end" className="glass z-50 w-72 rounded-2xl p-1.5">
              {[
                { icon: ImageDown, title: 'Image (PNG)', sub: 'A high-resolution picture of the wall', fn: () => run('Exporting image', () => exportPng(getDoc())) },
                { icon: FileText, title: 'Hanging guide (PDF)', sub: 'Diagram + nail measurements', fn: () => run('Building hanging guide', () => hangingGuidePdf(getDoc())) },
                { icon: Scissors, title: 'Paper templates (PDF)', sub: '1:1 outlines to tape on the wall', fn: () => run('Building templates', () => paperTemplatesPdf(getDoc())) },
                { icon: Download, title: 'Save .wall file', sub: 'Layout + photos, to back up or share', fn: () => run('Packing wall file', () => exportWallFile(getDoc())) },
                {
                  icon: Upload,
                  title: 'Open .wall file',
                  sub: 'Import a saved wall',
                  fn: () =>
                    openFilePicker(
                      ([file]) =>
                        run('Importing', async () => {
                          const doc = await importWallFile(file);
                          loadWall(doc);
                        }),
                      false,
                      '.wall,application/zip',
                    ),
                },
              ].map((m) => (
                <Popover.Close asChild key={m.title}>
                  <button onClick={m.fn} className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left hover:bg-white/8">
                    <m.icon size={16} className="text-accent-soft" />
                    <div>
                      <div className="text-[12.5px] font-medium text-white">{m.title}</div>
                      <div className="text-[11px] text-ink-400">{m.sub}</div>
                    </div>
                  </button>
                </Popover.Close>
              ))}
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
        <Divider />
        <Segmented
          size="sm"
          value={units}
          options={[
            { value: 'in', label: 'in' },
            { value: 'cm', label: 'cm' },
          ]}
          onChange={(u) => commit((d) => void (d.prefs.units = u))}
        />
        <IconButton label="Keyboard shortcuts (?)" onClick={() => ui().set({ modal: 'shortcuts' })} className={clsx('ml-0.5')}>
          <Keyboard size={16} />
        </IconButton>
      </div>
    </div>
  );
}

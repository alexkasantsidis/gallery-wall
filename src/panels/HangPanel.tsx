import { AnimatePresence, motion } from 'motion/react';
import { ChevronLeft, ChevronRight, X, FileText } from 'lucide-react';
import { useUi, ui } from '../store/uiStore';
import { useDoc, getDoc } from '../store/docStore';
import { hangingPlan } from '../geometry/hanging';
import { styleById } from '../model/frameStyles';
import { formatLength, formatSize } from '../model/units';
import { fitRect } from '../store/camera';
import { Button, IconButton } from '../components/ui';
const hangingGuidePdf = async (...a: Parameters<typeof import('../export/pdf').hangingGuidePdf>) => (await import('../export/pdf')).hangingGuidePdf(...a);

/** Step-by-step hanging mode: one frame at a time with its nail measurements. */
export function HangPanel() {
  const step = useUi((s) => s.hangStep);
  const doc = useDoc((s) => s.doc);
  const plan = step != null ? hangingPlan(doc) : [];
  const cur = plan.find((p) => p.index === step);
  const units = doc.prefs.units;

  const go = (n: number) => {
    const p = plan.find((x) => x.index === n);
    if (!p) return;
    ui().set({ hangStep: n });
    const r = p.rect;
    fitRect({ x: r.x - 20, y: r.y - 20, w: r.w + 40, h: Math.max(r.h + 40, doc.wall.height - r.y + 4) }, { animated: true, padding: 120, maxZoom: 0.6 });
  };

  return (
    <AnimatePresence>
      {step != null && (
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 30, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 380, damping: 32 }}
          className="glass pointer-events-auto absolute bottom-4 left-1/2 z-20 w-[min(560px,calc(100vw-32px))] -translate-x-1/2 rounded-2xl p-3"
        >
          {plan.length === 0 ? (
            <div className="flex items-center justify-between text-[12.5px] text-ink-300">
              Add some frames to get hanging measurements.
              <IconButton onClick={() => ui().set({ hangStep: null })}>
                <X size={15} />
              </IconButton>
            </div>
          ) : (
            cur && (
              <div className="flex items-center gap-3">
                <IconButton label="Previous" tipSide="top" disabled={step! <= 1} onClick={() => go(step! - 1)}>
                  <ChevronLeft size={18} />
                </IconButton>
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#ffb020] text-[17px] font-bold text-black">{cur.index}</div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-semibold text-white">
                    {cur.item.name || styleById(cur.item.styleId).name} · {formatSize(cur.item.nominal.w, cur.item.nominal.h, units)}
                  </div>
                  <div className="text-[12px] text-ink-300">
                    {cur.nails.length === 2 ? 'Two nails' : 'Nail'} <b className="text-[#ffb020]">{formatLength(cur.nails[0].fromFloor, units)}</b> from floor, at{' '}
                    <b className="text-[#ffb020]">{cur.nails.map((n) => formatLength(n.fromLeft, units)).join(' and ')}</b> from the left wall edge
                  </div>
                  <div className="text-[11px] text-ink-500">
                    {cur.item.hanger.kind === 'wire' ? `Wire pulled taut sits ${formatLength(cur.item.hanger.drop, units)} below the frame top` : `${cur.item.hanger.kind} ${formatLength(cur.item.hanger.drop, units)} below the top`} · {cur.index} of {plan.length}
                  </div>
                </div>
                <IconButton label="Next" tipSide="top" disabled={step! >= plan.length} onClick={() => go(step! + 1)}>
                  <ChevronRight size={18} />
                </IconButton>
                <Button variant="soft" className="px-2" onClick={() => hangingGuidePdf(getDoc())} title="Download PDF guide">
                  <FileText size={14} />
                </Button>
                <IconButton label="Exit hang mode" tipSide="top" onClick={() => ui().set({ hangStep: null })}>
                  <X size={15} />
                </IconButton>
              </div>
            )
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
